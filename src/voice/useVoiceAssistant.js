import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { initialVoiceSession, TRANSIENT_STATUSES, VOICE_STATUS, voiceSessionReducer } from './voiceMachine'

// --- OpenAI Realtime, vía WebRTC --------------------------------------------------------
// Turn-taking (VAD) ahora vive en el servidor de OpenAI (session.audio.input.turn_detection,
// configurado en api/realtime-session.js) — este archivo ya no calcula RMS para decidir
// cuándo termina un turno, solo para pintar el nivel de entrada/salida que consume el orbe.
// La detección de "el asistente ya está sonando" sí sigue siendo local (ver
// OUTPUT_SPEAKING_LEVEL más abajo): la documentación de OpenAI no confirma un evento propio
// de "el audio de salida empezó a sonar" para el transporte WebRTC, así que se usa el mismo
// analisis de energía que ya existía para el nivel de salida, con un umbral bajo.
const OUTPUT_SPEAKING_LEVEL = 0.03

// --- Redes de seguridad --------------------------------------------------------------------
const LISTENING_IDLE_MS = 15_000   // nunca llego input_audio_buffer.speech_started
const SESSION_WATCHDOG_MS = 40_000 // cualquier estado transitorio que no resuelva
const TOKEN_REQUEST_TIMEOUT_MS = 10_000

const permissionError = error => {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return ['microphone_denied', 'Permiso de micrófono rechazado.']
  if (error?.name === 'NotFoundError') return ['microphone_missing', 'No se encontró un micrófono disponible.']
  return ['microphone_failed', 'No fue posible activar el micrófono.']
}

export function useVoiceAssistant() {
  const [session, dispatch] = useReducer(voiceSessionReducer, initialVoiceSession)
  const [microphoneActive, setMicrophoneActive] = useState(false)
  const signalsRef = useRef({ inputLevel: 0, outputLevel: 0, activationImpulse: 0 })
  const micStreamRef = useRef(null)
  const pcRef = useRef(null)
  const dcRef = useRef(null)
  const inputContextRef = useRef(null)
  const inputAnalyserRef = useRef(null)
  const outputContextRef = useRef(null)
  const outputAnalyserRef = useRef(null)
  const outputSourceRef = useRef(null)
  const audioRef = useRef(null)
  const inputFrameRef = useRef(0)
  const outputFrameRef = useRef(0)
  const settlingTimerRef = useRef(0)
  const idleTimerRef = useRef(0)
  const heardSpeechRef = useRef(false)
  const respondingRef = useRef(false) // true entre response.created y el primer nivel de salida audible
  const statusRef = useRef(session.status)
  statusRef.current = session.status

  const stopInputMeter = useCallback(() => {
    cancelAnimationFrame(inputFrameRef.current)
    inputAnalyserRef.current?.disconnect?.()
    inputAnalyserRef.current = null
    if (inputContextRef.current && inputContextRef.current.state !== 'closed') inputContextRef.current.close().catch(() => {})
    inputContextRef.current = null
    signalsRef.current.inputLevel = 0
  }, [])

  const stopOutputMeter = useCallback(() => {
    cancelAnimationFrame(outputFrameRef.current)
    outputSourceRef.current?.disconnect?.()
    outputAnalyserRef.current?.disconnect?.()
    outputSourceRef.current = null
    outputAnalyserRef.current = null
    signalsRef.current.outputLevel = 0
  }, [])

  // Cierra la sesion Realtime por completo: peer connection, data channel, pistas del
  // microfono, medidores de nivel y temporizadores. Es el equivalente al viejo
  // stopCapture+stopOutput combinados, porque ahora todo vive en la misma conexion.
  const teardown = useCallback(() => {
    window.clearTimeout(idleTimerRef.current)
    stopInputMeter()
    stopOutputMeter()
    dcRef.current?.close?.()
    dcRef.current = null
    pcRef.current?.getSenders?.().forEach(sender => sender.track?.stop())
    pcRef.current?.close?.()
    pcRef.current = null
    micStreamRef.current?.getTracks().forEach(track => track.stop())
    micStreamRef.current = null
    setMicrophoneActive(false)
    const audio = audioRef.current
    if (audio) { audio.pause(); audio.srcObject = null }
  }, [stopInputMeter, stopOutputMeter])

  const settle = useCallback(() => {
    teardown()
    dispatch({ type: 'STOP' })
    window.clearTimeout(settlingTimerRef.current)
    settlingTimerRef.current = window.setTimeout(() => dispatch({ type: 'SETTLED' }), 650)
  }, [teardown])

  const fail = useCallback((code, message) => {
    teardown()
    dispatch({ type: 'FAIL', code, message })
  }, [teardown])

  // Debe ejecutarse dentro del gesto de clic y ANTES de cualquier await, o iOS bloquea el
  // audio. El <audio> y el AudioContext de salida se crean aqui; el analizador se conecta
  // despues, en cuanto pc.ontrack entregue el stream remoto.
  const unlockOutput = useCallback(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const audio = audioRef.current || new Audio()
    audio.autoplay = true
    audio.playsInline = true
    audioRef.current = audio
    const context = outputContextRef.current || new AudioContextClass()
    outputContextRef.current = context
    context.resume().catch(() => {})
  }, [])

  const attachOutputAnalyser = useCallback(remoteStream => {
    const context = outputContextRef.current
    if (!context) return
    const analyser = context.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.72
    const source = context.createMediaStreamSource(remoteStream)
    // No se conecta a destination: la reproduccion real la hace el <audio> via srcObject.
    // Este grafo paralelo existe solo para medir energia.
    source.connect(analyser)
    outputSourceRef.current = source
    outputAnalyserRef.current = analyser

    const samples = new Uint8Array(analyser.frequencyBinCount)
    const measure = () => {
      if (!outputAnalyserRef.current) return
      analyser.getByteFrequencyData(samples)
      let sum = 0
      for (const value of samples) sum += value
      const level = Math.min(1, (sum / samples.length) / 96)
      signalsRef.current.outputLevel = level
      if (respondingRef.current && level >= OUTPUT_SPEAKING_LEVEL) {
        respondingRef.current = false
        dispatch({ type: 'PLAYBACK_STARTED' })
      }
      outputFrameRef.current = requestAnimationFrame(measure)
    }
    measure()
  }, [])

  const startInputMeter = useCallback(stream => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    const context = new AudioContextClass()
    inputContextRef.current = context
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.78
    context.createMediaStreamSource(stream).connect(analyser)
    inputAnalyserRef.current = analyser

    const samples = new Uint8Array(analyser.frequencyBinCount)
    const measure = () => {
      if (!inputAnalyserRef.current) return
      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const value of samples) { const normalized = (value - 128) / 128; sum += normalized * normalized }
      signalsRef.current.inputLevel = Math.min(1, Math.sqrt(sum / samples.length) * 4.2)
      inputFrameRef.current = requestAnimationFrame(measure)
    }
    measure()
  }, [])

  // Mensajes del data channel "oai-events". Solo se manejan los tipos que necesitamos;
  // cualquier otro se ignora (compatibilidad hacia adelante si OpenAI agrega eventos).
  const handleRealtimeEvent = useCallback(event => {
    let message
    try { message = JSON.parse(event.data) } catch { return }
    switch (message.type) {
      case 'input_audio_buffer.speech_started':
        heardSpeechRef.current = true
        window.clearTimeout(idleTimerRef.current)
        dispatch({ type: 'SPEECH_STARTED' })
        break
      case 'response.created':
        respondingRef.current = true
        dispatch({ type: 'RESPONSE_STARTED' })
        break
      case 'response.done':
        respondingRef.current = false
        dispatch({ type: 'PLAYBACK_ENDED' })
        window.clearTimeout(settlingTimerRef.current)
        settlingTimerRef.current = window.setTimeout(() => { teardown(); dispatch({ type: 'SETTLED' }) }, 700)
        break
      case 'error':
        fail(message.error?.code || 'realtime_error', message.error?.message || 'La sesión de voz encontró un error.')
        break
      default:
        break
    }
  }, [fail, teardown])

  const start = useCallback(async () => {
    if (statusRef.current !== VOICE_STATUS.IDLE && statusRef.current !== VOICE_STATUS.ERROR) return settle()
    signalsRef.current.activationImpulse += 1
    unlockOutput()
    dispatch({ type: 'ACTIVATE' })

    if (typeof RTCPeerConnection === 'undefined') {
      return fail('webrtc_unsupported', 'Este navegador no permite conexiones de voz en tiempo real.')
    }

    let clientSecret
    try {
      const response = await fetch('/api/realtime-session', { method: 'POST', signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const error = new Error(payload?.error?.message || 'No fue posible iniciar la sesión de voz.')
        error.code = payload?.error?.code || 'realtime_session_failed'
        throw error
      }
      clientSecret = payload.clientSecret
      if (!clientSecret) throw Object.assign(new Error('Respuesta de sesión inválida.'), { code: 'realtime_session_failed' })
    } catch (error) {
      return fail(error?.code || 'realtime_session_failed', error?.message || 'No fue posible iniciar la sesión de voz.')
    }

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      })
    } catch (error) {
      const [code, message] = permissionError(error)
      return fail(code, message)
    }
    micStreamRef.current = stream
    setMicrophoneActive(true)
    startInputMeter(stream)

    try {
      const pc = new RTCPeerConnection()
      pcRef.current = pc
      pc.ontrack = event => { attachOutputAnalyser(event.streams[0]); if (audioRef.current) audioRef.current.srcObject = event.streams[0] }
      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc
      dc.onmessage = handleRealtimeEvent
      dc.onopen = () => {
        dispatch({ type: 'PERMISSION_GRANTED' })
        heardSpeechRef.current = false
        idleTimerRef.current = window.setTimeout(() => {
          if (!heardSpeechRef.current) fail('no_speech_detected', 'No se captó tu voz. Revisa el micrófono e intenta de nuevo.')
        }, LISTENING_IDLE_MS)
      }
      dc.onerror = () => fail('realtime_connection_failed', 'Se perdió la conexión de voz.')

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Shape verificado contra https://developers.openai.com/api/docs/guides/realtime-webrtc
      const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: { Authorization: `Bearer ${clientSecret}`, 'Content-Type': 'application/sdp' },
      })
      if (!sdpResponse.ok) throw new Error(`sdp_exchange_failed:${sdpResponse.status}`)
      const answerSdp = await sdpResponse.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
    } catch (error) {
      console.error('[voice] WebRTC:', error instanceof Error ? error.message : 'unknown_error')
      return fail('realtime_connection_failed', 'No fue posible conectar la sesión de voz.')
    }
  }, [attachOutputAnalyser, fail, handleRealtimeEvent, settle, startInputMeter, unlockOutput])

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
    teardown()
    if (outputContextRef.current && outputContextRef.current.state !== 'closed') outputContextRef.current.close().catch(() => {})
  }, [teardown])

  return { session, signals: signalsRef.current, microphoneActive, start, stop: settle }
}
