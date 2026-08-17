import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { initialVoiceSession, VOICE_STATUS, voiceSessionReducer } from './voiceMachine'

// Redes de seguridad para LISTENING. Sin ellas la unica salida del estado es un onresult
// con isFinal: si el reconocedor muere en silencio, la app se cuelga para siempre.
// Son dos temporizadores distintos a proposito:
//   IDLE  — no llega ningun resultado (ni parcial): el reconocedor esta muerto.
//   CAP   — llegan parciales pero nunca un final (comportamiento conocido en Android):
//           se cierra el turno con lo mejor que se haya transcrito.
const LISTENING_IDLE_MS = 15_000
const LISTENING_CAP_MS = 30_000

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
  const recognitionRef = useRef(null)
  const levelFrameRef = useRef(0)
  const outputFrameRef = useRef(0)
  const settlingTimerRef = useRef(0)
  const idleTimerRef = useRef(0)
  const capTimerRef = useRef(0)
  // Distingue un cierre deliberado (finalizar turno, detener, error ya manejado) de una
  // muerte espontanea del reconocedor. abort() dispara onend y onerror('aborted'), asi que
  // sin esta bandera no se puede saber si el evento lo provocamos nosotros o el navegador.
  const closingRef = useRef(false)
  const interimRef = useRef('')
  const statusRef = useRef(session.status)
  statusRef.current = session.status

  const stopInput = useCallback(() => {
    cancelAnimationFrame(levelFrameRef.current)
    window.clearTimeout(idleTimerRef.current)
    window.clearTimeout(capTimerRef.current)
    closingRef.current = true
    recognitionRef.current?.abort?.()
    recognitionRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setMicrophoneActive(false)
    analyserRef.current?.disconnect?.()
    analyserRef.current = null
    if (inputContextRef.current && inputContextRef.current.state !== 'closed') inputContextRef.current.close().catch(() => {})
    inputContextRef.current = null
    signalsRef.current.inputLevel = 0
  }, [])

  const stopOutput = useCallback(() => {
    cancelAnimationFrame(outputFrameRef.current)
    const audio = audioRef.current
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load() }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = ''
    signalsRef.current.outputLevel = 0
  }, [])

  const settle = useCallback(() => {
    stopInput()
    stopOutput()
    dispatch({ type: 'STOP' })
    window.clearTimeout(settlingTimerRef.current)
    settlingTimerRef.current = window.setTimeout(() => dispatch({ type: 'SETTLED' }), 650)
  }, [stopInput, stopOutput])

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
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const error = new Error(payload?.error?.message || 'No fue posible conectar con Nasus.')
        error.code = payload?.error?.code || 'request_failed'
        throw error
      }
      dispatch({ type: 'RESPONSE_READY', text: payload.text })
      if (payload.audio) await playResponse(payload.audio, payload.mimeType)
      else await new Promise(resolve => window.setTimeout(resolve, 1600))
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

  const start = useCallback(async () => {
    if (statusRef.current !== VOICE_STATUS.IDLE && statusRef.current !== VOICE_STATUS.ERROR) return settle()
    signalsRef.current.activationImpulse += 1
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
      const samples = new Uint8Array(analyser.frequencyBinCount)
      const measure = () => {
        if (!analyserRef.current) return
        analyser.getByteTimeDomainData(samples)
        let sum = 0
        for (const value of samples) { const normalized = (value - 128) / 128; sum += normalized * normalized }
        signalsRef.current.inputLevel = Math.min(1, Math.sqrt(sum / samples.length) * 4.2)
        levelFrameRef.current = requestAnimationFrame(measure)
      }
      measure()

      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!Recognition) throw Object.assign(new Error('speech_recognition_unsupported'), { name: 'NotSupportedError' })
      const recognition = new Recognition()
      recognition.lang = 'es-MX'
      recognition.continuous = false
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      recognitionRef.current = recognition
      closingRef.current = false
      interimRef.current = ''

      const abandonListening = (code, message) => {
        stopInput()
        dispatch({ type: 'FAIL', code, message })
      }
      const finalizeTurn = transcript => {
        stopInput()
        dispatch({ type: 'TRANSCRIPT_READY', transcript })
        requestAssistant(transcript)
      }
      const armIdleTimer = () => {
        window.clearTimeout(idleTimerRef.current)
        idleTimerRef.current = window.setTimeout(
          () => abandonListening('recognition_idle', 'El reconocimiento de voz dejó de responder. Intenta de nuevo.'),
          LISTENING_IDLE_MS,
        )
      }

      recognition.onresult = event => {
        armIdleTimer()
        let transcript = ''
        let finalTranscript = ''
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          transcript += event.results[index][0]?.transcript || ''
          if (event.results[index].isFinal) finalTranscript += event.results[index][0]?.transcript || ''
        }
        const partial = transcript.trim()
        if (partial) interimRef.current = partial
        dispatch({ type: 'TRANSCRIPT_UPDATE', transcript: partial })
        if (finalTranscript.trim()) finalizeTurn(finalTranscript.trim())
      }

      // El reconocedor termina la sesion en TODA ruta de salida, incluidas las que no
      // entregan un resultado final. Sin este handler el estado se quedaba en listening
      // indefinidamente y el microfono seguia abierto.
      recognition.onend = () => {
        if (closingRef.current) { closingRef.current = false; return }
        const partial = interimRef.current.trim()
        if (partial) return finalizeTurn(partial)
        abandonListening('recognition_no_result', 'No se captó tu voz. Revisa que ninguna otra app esté usando el micrófono.')
      }

      recognition.onerror = event => {
        // 'aborted' es esperado cuando el cierre lo provocamos nosotros; espontaneo es un fallo real.
        if (event.error === 'aborted' && closingRef.current) return
        abandonListening(
          `recognition_${event.error}`,
          event.error === 'no-speech' ? 'No escuché ninguna voz. Intenta de nuevo.' : 'No fue posible reconocer tu voz.',
        )
      }

      recognition.start()
      armIdleTimer()
      capTimerRef.current = window.setTimeout(() => {
        const partial = interimRef.current.trim()
        if (partial) finalizeTurn(partial)
        else abandonListening('recognition_timeout', 'No se recibió tu voz a tiempo. Intenta de nuevo.')
      }, LISTENING_CAP_MS)
      dispatch({ type: 'PERMISSION_GRANTED' })
    } catch (error) {
      stopInput()
      const [code, message] = error?.name === 'NotSupportedError'
        ? ['recognition_unsupported', 'El reconocimiento de voz no está disponible en este navegador.']
        : permissionError(error)
      dispatch({ type: 'FAIL', code, message })
    }
  }, [requestAssistant, settle, stopInput, unlockOutput])

  useEffect(() => () => {
    window.clearTimeout(settlingTimerRef.current)
    stopInput()
    stopOutput()
    if (outputContextRef.current && outputContextRef.current.state !== 'closed') outputContextRef.current.close().catch(() => {})
  }, [stopInput, stopOutput])

  return { session, signals: signalsRef.current, microphoneActive, start, stop: settle }
}
