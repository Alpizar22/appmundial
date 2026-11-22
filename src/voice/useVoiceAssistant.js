import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { initialVoiceSession, TRANSIENT_STATUSES, VOICE_STATUS, voiceSessionReducer } from './voiceMachine'

// --- OpenAI GPT-Live, vía WebRTC ---------------------------------------------------------
// El navegador manda su oferta SDP a /api/live-session; el servidor la intercambia con OpenAI
// (la llave nunca sale del servidor) y devuelve la respuesta. La conversacion es continua:
// GPT-Live decide los turnos. Este archivo solo traduce eventos y niveles de audio a:
//   - `session.status`  -> el modo del orbe (listening / processing / speaking ...)
//   - `signals`         -> inputLevel / outputLevel / activationImpulse, un ref mutado en sitio
//                          que el orbe lee cada frame sin provocar re-render.
//
// Eventos del data channel `oai-events` que usamos (el resto se ignora):
//   session.started, session.closed, session.input_transcript.delta, session.output_transcript.delta

const USER_TALKING_LEVEL = 0.12     // nivel de mic que cuenta como "la persona esta hablando"
const USER_DONE_MS = 750            // silencio tras hablar => la respuesta esta en camino (procesando)
const PROCESSING_GIVEUP_MS = 12_000 // si no suena nada, volver a escuchar
const AGENT_ON_LEVEL = 0.03         // nivel de salida que cuenta como "el agente esta hablando"
const AGENT_OFF_MS = 900            // silencio de salida que cierra la intervencion del agente
const AUTO_CLOSE_MS = 9_000         // tras responder, sin que la persona hable: cerrar (ahorra costo)
const CONNECT_TIMEOUT_MS = 12_000
const CLOSE_GRACE_MS = 400          // margen para que session.close llegue antes de cortar WebRTC
const DEFAULT_MAX_SECONDS = 90
const WATCHDOG_MS = 40_000

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
  const audioContextRef = useRef(null)
  const inputAnalyserRef = useRef(null)
  const outputAnalyserRef = useRef(null)
  const sourcesRef = useRef([])
  const audioRef = useRef(null)
  const frameRef = useRef(0)
  const timersRef = useRef({ connect: 0, limit: 0, close: 0, settle: 0, auto: 0 })
  const liveRef = useRef({ started: false, userTalking: false, lastUserLoud: 0, agentSpeaking: false, lastAgentLoud: 0, processingSince: 0, responding: false })
  const statusRef = useRef(session.status)
  statusRef.current = session.status

  const clearTimers = useCallback(() => {
    const t = timersRef.current
    window.clearTimeout(t.connect); window.clearTimeout(t.limit); window.clearTimeout(t.close); window.clearTimeout(t.auto)
    t.connect = t.limit = t.close = t.auto = 0
  }, [])

  const stopMeters = useCallback(() => {
    cancelAnimationFrame(frameRef.current)
    sourcesRef.current.forEach(node => node.disconnect?.())
    sourcesRef.current = []
    inputAnalyserRef.current = null
    outputAnalyserRef.current = null
    signalsRef.current.inputLevel = 0
    signalsRef.current.outputLevel = 0
  }, [])

  // Cierra todo: peer connection, data channel, mic, medidores y temporizadores.
  const teardown = useCallback(() => {
    clearTimers()
    stopMeters()
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
    liveRef.current = { started: false, userTalking: false, lastUserLoud: 0, agentSpeaking: false, lastAgentLoud: 0, processingSince: 0, responding: false }
  }, [clearTimers, stopMeters])

  const settleNow = useCallback(() => {
    teardown()
    dispatch({ type: 'STOP' })
    window.clearTimeout(timersRef.current.settle)
    timersRef.current.settle = window.setTimeout(() => dispatch({ type: 'SETTLED' }), 650)
  }, [teardown])

  // Cierre ordenado: avisa a GPT-Live (para que deje de cobrar) y corta unos ms despues.
  const settle = useCallback(() => {
    const channel = dcRef.current
    if (channel?.readyState === 'open') {
      try { channel.send(JSON.stringify({ type: 'session.close' })) } catch { /* el corte de abajo cierra igual */ }
      dispatch({ type: 'STOP' })
      window.clearTimeout(timersRef.current.close)
      timersRef.current.close = window.setTimeout(settleNow, CLOSE_GRACE_MS)
      return
    }
    settleNow()
  }, [settleNow])

  const fail = useCallback((code, message) => {
    teardown()
    dispatch({ type: 'FAIL', code, message })
  }, [teardown])

  // Debe ejecutarse dentro del gesto de clic y ANTES de cualquier await, o iOS bloquea el audio.
  const unlockAudio = useCallback(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const audio = audioRef.current || new Audio()
    audio.autoplay = true
    audio.playsInline = true
    audioRef.current = audio
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') audioContextRef.current = new AudioContextClass()
    audioContextRef.current.resume().catch(() => {})
  }, [])

  const makeAnalyser = (context, stream, fftSize, smoothing) => {
    const analyser = context.createAnalyser()
    analyser.fftSize = fftSize
    analyser.smoothingTimeConstant = smoothing
    const source = context.createMediaStreamSource(stream)
    source.connect(analyser) // sin conectar a destination: solo mide; la reproduccion la hace <audio>
    sourcesRef.current.push(source, analyser)
    return analyser
  }

  // Un solo bucle por frame: mide mic y salida, escribe `signals` y deduce los estados que
  // GPT-Live no anuncia por evento (cuando suena el agente y cuando "piensa").
  const startMeterLoop = useCallback(() => {
    const inputSamples = new Uint8Array(512)
    const outputSamples = new Uint8Array(128)
    const tick = () => {
      const now = performance.now()
      const live = liveRef.current
      const signals = signalsRef.current

      const inputAnalyser = inputAnalyserRef.current
      if (inputAnalyser) {
        inputAnalyser.getByteTimeDomainData(inputSamples)
        let sum = 0
        for (const value of inputSamples) { const n = (value - 128) / 128; sum += n * n }
        signals.inputLevel = Math.min(1, Math.sqrt(sum / inputSamples.length) * 4.2)
      }
      const outputAnalyser = outputAnalyserRef.current
      if (outputAnalyser) {
        outputAnalyser.getByteFrequencyData(outputSamples)
        let sum = 0
        for (const value of outputSamples) sum += value
        signals.outputLevel = Math.min(1, (sum / outputSamples.length) / 96)
      }

      if (live.started) {
        const status = statusRef.current
        const talking = signals.inputLevel >= USER_TALKING_LEVEL && signals.outputLevel < AGENT_ON_LEVEL
        if (talking) {
          live.lastUserLoud = now
          if (!live.userTalking) { live.userTalking = true; window.clearTimeout(timersRef.current.auto); if (status !== VOICE_STATUS.LISTENING) dispatch({ type: 'SPEECH_STARTED' }) }
        }
        // La persona dejo de hablar: la respuesta esta en camino.
        if (live.userTalking && now - live.lastUserLoud > USER_DONE_MS && !live.agentSpeaking) {
          live.userTalking = false
          live.processingSince = now
          dispatch({ type: 'RESPONSE_STARTED' })
        }
        if (status === VOICE_STATUS.PROCESSING && !live.agentSpeaking && live.processingSince && now - live.processingSince > PROCESSING_GIVEUP_MS) {
          live.processingSince = 0
          dispatch({ type: 'SPEECH_STARTED' }) // vuelve a LISTENING
        }
        // El agente suena / termina de sonar.
        if (signals.outputLevel >= AGENT_ON_LEVEL) {
          live.lastAgentLoud = now
          if (!live.agentSpeaking) { live.agentSpeaking = true; live.userTalking = false; live.processingSince = 0; window.clearTimeout(timersRef.current.auto); dispatch({ type: 'PLAYBACK_STARTED' }) }
        } else if (live.agentSpeaking && now - live.lastAgentLoud > AGENT_OFF_MS) {
          live.agentSpeaking = false
          dispatch({ type: 'PLAYBACK_ENDED' })
          // Conversacion continua, pero si la persona no contesta se cierra para no gastar.
          window.clearTimeout(timersRef.current.auto)
          timersRef.current.auto = window.setTimeout(() => { if (!liveRef.current.userTalking) settle() }, AUTO_CLOSE_MS)
        }
      }
      frameRef.current = requestAnimationFrame(tick)
    }
    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(tick)
  }, [settle])

  const handleEvent = useCallback(event => {
    let message
    try { message = JSON.parse(event.data) } catch { return }
    const live = liveRef.current
    switch (message.type) {
      case 'session.started':
        window.clearTimeout(timersRef.current.connect)
        live.started = true
        dispatch({ type: 'PERMISSION_GRANTED' })
        startMeterLoop()
        // Tope de duracion del lado del cliente (el servidor ya reservo ese tiempo).
        timersRef.current.limit = window.setTimeout(settle, (liveRef.current.maxSeconds || DEFAULT_MAX_SECONDS) * 1000)
        // Si nadie habla en un rato, no dejar la sesion abierta.
        timersRef.current.auto = window.setTimeout(() => { if (!liveRef.current.userTalking && !liveRef.current.agentSpeaking) settle() }, AUTO_CLOSE_MS * 2)
        break
      case 'session.input_transcript.delta':
        window.clearTimeout(timersRef.current.auto)
        if (statusRef.current !== VOICE_STATUS.LISTENING && !live.agentSpeaking) dispatch({ type: 'SPEECH_STARTED' })
        break
      case 'session.output_transcript.delta':
        // El texto de la respuesta llega antes que el audio: ya esta "pensando" en voz alta.
        if (!live.agentSpeaking && statusRef.current === VOICE_STATUS.LISTENING) { live.processingSince = performance.now(); dispatch({ type: 'RESPONSE_STARTED' }) }
        break
      case 'session.closed':
        settleNow()
        break
      case 'error':
        fail(message.error?.code || 'live_error', message.error?.message || 'La sesión de voz encontró un error.')
        break
      default:
        break
    }
  }, [fail, settle, settleNow, startMeterLoop])

  const start = useCallback(async () => {
    if (statusRef.current !== VOICE_STATUS.IDLE && statusRef.current !== VOICE_STATUS.ERROR) return settle()
    signalsRef.current.activationImpulse += 1
    unlockAudio()
    dispatch({ type: 'ACTIVATE' })

    if (typeof RTCPeerConnection === 'undefined') return fail('webrtc_unsupported', 'Este navegador no permite conexiones de voz en tiempo real.')

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
    } catch (error) {
      const [code, message] = permissionError(error)
      return fail(code, message)
    }
    micStreamRef.current = stream
    setMicrophoneActive(true)

    try {
      const pc = new RTCPeerConnection()
      pcRef.current = pc
      const context = audioContextRef.current
      if (context) inputAnalyserRef.current = makeAnalyser(context, stream, 512, 0.78)

      pc.addEventListener('track', trackEvent => {
        const remote = new MediaStream([trackEvent.track])
        if (audioRef.current) { audioRef.current.srcObject = remote; audioRef.current.play?.().catch(() => {}) }
        if (audioContextRef.current) outputAnalyserRef.current = makeAnalyser(audioContextRef.current, remote, 256, 0.72)
      })
      stream.getAudioTracks().forEach(track => pc.addTrack(track, stream))

      const channel = pc.createDataChannel('oai-events')
      dcRef.current = channel
      channel.onmessage = handleEvent
      channel.onclose = () => { if (dcRef.current === channel && liveRef.current.started) settleNow() }

      timersRef.current.connect = window.setTimeout(() => fail('live_connect_timeout', 'No pude conectar la voz. Intenta de nuevo.'), CONNECT_TIMEOUT_MS)

      await pc.setLocalDescription(await pc.createOffer())
      // GPT-Live recibe el SDP completo: se espera a que termine la recoleccion de candidatos ICE.
      if (pc.iceGatheringState !== 'complete') {
        await new Promise(resolve => {
          const onChange = () => { if (pc.iceGatheringState !== 'complete') return; pc.removeEventListener('icegatheringstatechange', onChange); resolve() }
          pc.addEventListener('icegatheringstatechange', onChange)
          onChange()
        })
      }
      const sdp = pc.localDescription?.sdp
      if (!sdp) throw new Error('sin_sdp')

      const response = await fetch('/api/live-session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sdp }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.sdp) {
        return fail(payload?.error?.code || 'live_session_failed', payload?.error?.message || 'No fue posible iniciar la sesión de voz.')
      }
      liveRef.current.maxSeconds = Number(payload.maxSeconds) || DEFAULT_MAX_SECONDS
      await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp })
    } catch (error) {
      console.error('[voice] WebRTC:', error instanceof Error ? error.message : 'unknown_error')
      return fail('live_connection_failed', 'No fue posible conectar la sesión de voz.')
    }
  }, [fail, handleEvent, settle, settleNow, unlockAudio])

  // Vigilante: la activacion que no resuelve termina con un mensaje en vez de quedar colgada.
  useEffect(() => {
    if (!TRANSIENT_STATUSES.includes(session.status)) return undefined
    const timer = window.setTimeout(() => fail('session_stalled', 'La sesión dejó de responder. Intenta de nuevo.'), WATCHDOG_MS)
    return () => window.clearTimeout(timer)
  }, [session.status, fail])

  useEffect(() => () => {
    window.clearTimeout(timersRef.current.settle)
    teardown()
    const context = audioContextRef.current
    if (context && context.state !== 'closed') context.close().catch(() => {})
  }, [teardown])

  return { session, signals: signalsRef.current, microphoneActive, start, stop: settle }
}
