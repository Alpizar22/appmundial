import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { initialVoiceSession, TRANSIENT_STATUSES, VOICE_STATUS, voiceSessionReducer } from './voiceMachine'

// --- Deteccion de fin de turno -------------------------------------------------------------
// Se alimenta del mismo inputLevel que deforma el orbe, asi que lo que el usuario ve moverse
// es literalmente la señal que decide cuando ha terminado de hablar.
// Umbrales con histeresis: hace falta mas energia para empezar a hablar que para seguir
// hablando, de modo que una consonante suave no corta la frase.
const SPEECH_ON_LEVEL = 0.14
const SPEECH_OFF_LEVEL = 0.09
// Pausas naturales dentro de una frase rondan 200-600ms; un punto final se percibe sobre los
// 800ms. 1200ms deja hablar con comas sin que la espera se sienta lenta.
const SILENCE_HOLD_MS = 1200
// Evita que una tos o un golpe en la mesa cierren un turno vacio.
const MIN_SPEECH_MS = 400

// --- Redes de seguridad --------------------------------------------------------------------
const LISTENING_IDLE_MS = 15_000   // nunca se detecto voz: no hay nada que transcribir
const LISTENING_CAP_MS = 30_000    // tope duro de grabacion; se envia lo capturado
const SESSION_WATCHDOG_MS = 40_000 // cualquier estado transitorio que no resuelva
const REQUEST_TIMEOUT_MS = 30_000

const RECORDER_MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

const pickRecorderMime = () => {
  if (typeof MediaRecorder === 'undefined') return ''
  return RECORDER_MIME_CANDIDATES.find(type => MediaRecorder.isTypeSupported?.(type)) || ''
}

const blobToBase64 = async blob => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  return btoa(binary)
}

const permissionError = error => {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return ['microphone_denied', 'Permiso de micrófono rechazado.']
  if (error?.name === 'NotFoundError') return ['microphone_missing', 'No se encontró un micrófono disponible.']
  return ['microphone_failed', 'No fue posible activar el micrófono.']
}

export function useVoiceAssistant() {
  const [session, dispatch] = useReducer(voiceSessionReducer, initialVoiceSession)
  const [microphoneActive, setMicrophoneActive] = useState(false)
  const signalsRef = useRef({ inputLevel: 0, outputLevel: 0, activationImpulse: 0 })
  const streamRef = useRef(null)
  const inputContextRef = useRef(null)
  const analyserRef = useRef(null)
  const outputContextRef = useRef(null)
  const outputAnalyserRef = useRef(null)
  const outputSourceRef = useRef(null)
  const audioRef = useRef(null)
  const audioUrlRef = useRef('')
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const levelFrameRef = useRef(0)
  const outputFrameRef = useRef(0)
  const settlingTimerRef = useRef(0)
  const idleTimerRef = useRef(0)
  const capTimerRef = useRef(0)
  // Distingue un cierre que provocamos nosotros de uno espontaneo: stop() dispara onstop igual
  // que el fin de turno, y sin esta bandera no se puede saber si hay que transcribir o descartar.
  const closingRef = useRef(false)
  const vadRef = useRef({ startedAt: 0, speechAt: 0, lastVoiceAt: 0, speaking: false })
  const statusRef = useRef(session.status)
  statusRef.current = session.status

  const releaseMic = useCallback(() => {
    cancelAnimationFrame(levelFrameRef.current)
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setMicrophoneActive(false)
    analyserRef.current?.disconnect?.()
    analyserRef.current = null
    if (inputContextRef.current && inputContextRef.current.state !== 'closed') inputContextRef.current.close().catch(() => {})
    inputContextRef.current = null
    signalsRef.current.inputLevel = 0
  }, [])

  // Cerrar el turno y soltar el microfono son dos pasos, no uno. MediaRecorder.stop() entrega
  // el ultimo fragmento de forma asincrona: detener las pistas en el mismo tick puede truncar
  // o vaciar el blob. Cuando el audio se va a usar, quien libera el microfono es onstop, ya
  // con el blob construido; cuando se descarta, se libera de inmediato.
  const stopCapture = useCallback(discard => {
    window.clearTimeout(idleTimerRef.current)
    window.clearTimeout(capTimerRef.current)
    cancelAnimationFrame(levelFrameRef.current)
    const recorder = recorderRef.current
    recorderRef.current = null
    if (discard) closingRef.current = true
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop() } catch { releaseMic(); return }
      if (discard) releaseMic()
      return
    }
    releaseMic()
  }, [releaseMic])

  const stopOutput = useCallback(() => {
    cancelAnimationFrame(outputFrameRef.current)
    const audio = audioRef.current
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load() }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = ''
    signalsRef.current.outputLevel = 0
  }, [])

  const settle = useCallback(() => {
    stopCapture(true)
    stopOutput()
    dispatch({ type: 'STOP' })
    window.clearTimeout(settlingTimerRef.current)
    settlingTimerRef.current = window.setTimeout(() => dispatch({ type: 'SETTLED' }), 650)
  }, [stopCapture, stopOutput])

  const fail = useCallback((code, message) => {
    stopCapture(true)
    stopOutput()
    dispatch({ type: 'FAIL', code, message })
  }, [stopCapture, stopOutput])

  const unlockOutput = useCallback(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const audio = audioRef.current || new Audio()
    audio.preload = 'auto'
    audio.playsInline = true
    audioRef.current = audio
    const context = outputContextRef.current || new AudioContextClass()
    outputContextRef.current = context
    context.resume().catch(() => {})
    if (!outputSourceRef.current) {
      const analyser = context.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.72
      const source = context.createMediaElementSource(audio)
      source.connect(analyser)
      analyser.connect(context.destination)
      outputSourceRef.current = source
      outputAnalyserRef.current = analyser
    }
  }, [])

  const playResponse = useCallback(async (audioBase64, mimeType) => {
    if (!audioBase64 || !audioRef.current) return false
    const bytes = Uint8Array.from(atob(audioBase64), character => character.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType || 'audio/mpeg' }))
    audioUrlRef.current = url
    const audio = audioRef.current
    audio.src = url
    audio.load()
    await outputContextRef.current?.resume?.()
    const analyser = outputAnalyserRef.current
    const samples = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    const measure = () => {
      if (!samples || audio.paused || audio.ended) return
      analyser.getByteFrequencyData(samples)
      let sum = 0
      for (const value of samples) sum += value
      signalsRef.current.outputLevel = Math.min(1, (sum / samples.length) / 96)
      outputFrameRef.current = requestAnimationFrame(measure)
    }
    await audio.play()
    dispatch({ type: 'PLAYBACK_STARTED' })
    measure()
    await new Promise((resolve, reject) => {
      audio.onended = resolve
      audio.onerror = () => reject(new Error('audio_playback_failed'))
    })
    cancelAnimationFrame(outputFrameRef.current)
    signalsRef.current.outputLevel = 0
    URL.revokeObjectURL(url)
    audioUrlRef.current = ''
    return true
  }, [])

  const requestAssistant = useCallback(async transcript => {
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: transcript }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const error = new Error(payload?.error?.message || 'No fue posible conectar con Nasus.')
        error.code = payload?.error?.code || 'request_failed'
        throw error
      }
      dispatch({ type: 'RESPONSE_READY', text: payload.text })
      if (payload.audio) await playResponse(payload.audio, payload.mimeType)
      else { dispatch({ type: 'PLAYBACK_STARTED' }); await new Promise(resolve => window.setTimeout(resolve, 1600)) }
      dispatch({ type: 'PLAYBACK_ENDED' })
      window.clearTimeout(settlingTimerRef.current)
      settlingTimerRef.current = window.setTimeout(() => dispatch({ type: 'SETTLED' }), 700)
    } catch (error) {
      stopOutput()
      const autoplay = error?.name === 'NotAllowedError' || error?.message === 'audio_playback_failed'
      dispatch({
        type: 'FAIL',
        code: autoplay ? 'audio_blocked' : (error?.code || 'connection_failed'),
        message: autoplay ? 'Safari bloqueó el audio. Toca de nuevo para reproducir.' : (error?.message || 'No fue posible conectar con Nasus.'),
      })
    }
  }, [playResponse, stopOutput])

  const transcribeTurn = useCallback(async (blob, mimeType) => {
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: await blobToBase64(blob), mimeType }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const error = new Error(payload?.error?.message || 'No fue posible transcribir tu voz.')
        error.code = payload?.error?.code || 'transcription_failed'
        throw error
      }
      const transcript = (payload?.text || '').trim()
      if (!transcript) throw Object.assign(new Error('No se entendió lo que dijiste. Intenta de nuevo.'), { code: 'empty_transcript' })
      dispatch({ type: 'TRANSCRIPT_READY', transcript })
      await requestAssistant(transcript)
    } catch (error) {
      dispatch({
        type: 'FAIL',
        code: error?.code || 'transcription_failed',
        message: error?.message || 'No fue posible transcribir tu voz.',
      })
    }
  }, [requestAssistant])

  const start = useCallback(async () => {
    if (statusRef.current !== VOICE_STATUS.IDLE && statusRef.current !== VOICE_STATUS.ERROR) return settle()
    signalsRef.current.activationImpulse += 1
    // Debe ejecutarse dentro del gesto de clic y ANTES de cualquier await, o iOS bloquea el audio.
    unlockOutput()
    dispatch({ type: 'ACTIVATE' })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      })
      streamRef.current = stream
      setMicrophoneActive(true)

      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      const context = new AudioContextClass()
      inputContextRef.current = context
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.78
      context.createMediaStreamSource(stream).connect(analyser)
      analyserRef.current = analyser

      if (typeof MediaRecorder === 'undefined') throw Object.assign(new Error('recording_unsupported'), { name: 'NotSupportedError' })
      const mimeType = pickRecorderMime()
      // El MediaRecorder y el AnalyserNode consumen el MISMO MediaStream. Ambos son
      // consumidores legitimos y coexisten; el conflicto anterior venia de SpeechRecognition,
      // que no consumia el stream sino que abria su propia entrada de audio y competia por el
      // microfono, dejando al reconocedor sin señal en Android.
      chunksRef.current = []
      closingRef.current = false
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined)
      recorderRef.current = recorder
      recorder.ondataavailable = event => { if (event.data?.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        const parts = chunksRef.current
        chunksRef.current = []
        if (closingRef.current) { closingRef.current = false; return }
        const blob = new Blob(parts, { type: mimeType || 'audio/webm' })
        releaseMic()
        if (!blob.size) return fail('empty_recording', 'No se captó audio. Intenta de nuevo.')
        dispatch({ type: 'CAPTURE_ENDED' })
        transcribeTurn(blob, blob.type)
      }
      recorder.start()

      const finishTurn = () => { stopCapture(false) }
      const vad = vadRef.current
      vad.startedAt = performance.now()
      vad.speechAt = 0
      vad.lastVoiceAt = 0
      vad.speaking = false

      const samples = new Uint8Array(analyser.frequencyBinCount)
      const measure = () => {
        if (!analyserRef.current) return
        analyser.getByteTimeDomainData(samples)
        let sum = 0
        for (const value of samples) { const normalized = (value - 128) / 128; sum += normalized * normalized }
        const level = Math.min(1, Math.sqrt(sum / samples.length) * 4.2)
        signalsRef.current.inputLevel = level

        const now = performance.now()
        if (level >= SPEECH_ON_LEVEL) {
          if (!vad.speaking) { vad.speaking = true; vad.speechAt = vad.speechAt || now }
          vad.lastVoiceAt = now
        } else if (vad.speaking && level < SPEECH_OFF_LEVEL
          && now - vad.lastVoiceAt >= SILENCE_HOLD_MS
          && now - vad.speechAt >= MIN_SPEECH_MS) {
          return finishTurn()
        }
        levelFrameRef.current = requestAnimationFrame(measure)
      }
      measure()

      // Respaldos por temporizador: el bucle rAF se detiene si la pestaña pasa a segundo plano.
      idleTimerRef.current = window.setTimeout(() => {
        if (!vadRef.current.speaking) fail('no_speech_detected', 'No se captó tu voz. Revisa el micrófono e intenta de nuevo.')
      }, LISTENING_IDLE_MS)
      capTimerRef.current = window.setTimeout(() => {
        if (vadRef.current.speaking) finishTurn()
        else fail('recognition_timeout', 'No se recibió tu voz a tiempo. Intenta de nuevo.')
      }, LISTENING_CAP_MS)

      dispatch({ type: 'PERMISSION_GRANTED' })
    } catch (error) {
      stopCapture(true)
      const [code, message] = error?.name === 'NotSupportedError'
        ? ['recording_unsupported', 'Este navegador no permite grabar audio.']
        : permissionError(error)
      dispatch({ type: 'FAIL', code, message })
    }
  }, [fail, releaseMic, settle, stopCapture, transcribeTurn, unlockOutput])

  // Vigilante global: cualquier estado transitorio que no resuelva termina la sesion con un
  // mensaje en vez de dejarla colgada. Se re-arma en cada cambio de estado.
  useEffect(() => {
    if (!TRANSIENT_STATUSES.includes(session.status)) return undefined
    const timer = window.setTimeout(
      () => fail('session_stalled', 'La sesión dejó de responder. Intenta de nuevo.'),
      SESSION_WATCHDOG_MS,
    )
    return () => window.clearTimeout(timer)
  }, [session.status, fail])

  useEffect(() => () => {
    window.clearTimeout(settlingTimerRef.current)
    stopCapture(true)
    stopOutput()
    if (outputContextRef.current && outputContextRef.current.state !== 'closed') outputContextRef.current.close().catch(() => {})
  }, [stopCapture, stopOutput])

  return { session, signals: signalsRef.current, microphoneActive, start, stop: settle }
}
