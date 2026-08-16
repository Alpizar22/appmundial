import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { initialVoiceSession, VOICE_STATUS, voiceSessionReducer } from './voiceMachine'

const permissionError = error => {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return ['microphone_denied', 'Permiso de micrófono rechazado.']
  if (error?.name === 'NotFoundError') return ['microphone_missing', 'No se encontró un micrófono disponible.']
  return ['microphone_failed', 'No fue posible activar el micrófono.']
}

export function useVoiceAssistant() {
  const [session, dispatch] = useReducer(voiceSessionReducer, initialVoiceSession)
  const [inputLevel, setInputLevel] = useState(0)
  const streamRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const recognitionRef = useRef(null)
  const levelFrameRef = useRef(0)
  const settlingTimerRef = useRef(0)
  const statusRef = useRef(session.status)
  statusRef.current = session.status

  const stopInput = useCallback(() => {
    cancelAnimationFrame(levelFrameRef.current)
    recognitionRef.current?.abort?.()
    recognitionRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    analyserRef.current?.disconnect?.()
    analyserRef.current = null
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close().catch(() => {})
    audioContextRef.current = null
    setInputLevel(0)
  }, [])

  const settle = useCallback(() => {
    stopInput()
    dispatch({ type: 'STOP' })
    window.clearTimeout(settlingTimerRef.current)
    settlingTimerRef.current = window.setTimeout(() => dispatch({ type: 'SETTLED' }), 650)
  }, [stopInput])

  const start = useCallback(async () => {
    if (statusRef.current !== VOICE_STATUS.IDLE && statusRef.current !== VOICE_STATUS.ERROR) return settle()
    dispatch({ type: 'ACTIVATE' })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      })
      streamRef.current = stream
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      const context = new AudioContextClass()
      audioContextRef.current = context
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
        setInputLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4.2))
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
      recognition.onresult = event => {
        let transcript = ''
        let finalTranscript = ''
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          transcript += event.results[index][0]?.transcript || ''
          if (event.results[index].isFinal) finalTranscript += event.results[index][0]?.transcript || ''
        }
        dispatch({ type: 'TRANSCRIPT_UPDATE', transcript: transcript.trim() })
        if (finalTranscript.trim()) {
          stopInput()
          dispatch({ type: 'TRANSCRIPT_READY', transcript: finalTranscript.trim() })
        }
      }
      recognition.onerror = event => {
        if (event.error === 'aborted') return
        stopInput()
        dispatch({ type: 'FAIL', code: `recognition_${event.error}`, message: event.error === 'no-speech' ? 'No escuché ninguna voz. Intenta de nuevo.' : 'No fue posible reconocer tu voz.' })
      }
      recognition.start()
      dispatch({ type: 'PERMISSION_GRANTED' })
    } catch (error) {
      stopInput()
      const [code, message] = error?.name === 'NotSupportedError'
        ? ['recognition_unsupported', 'El reconocimiento de voz no está disponible en este navegador.']
        : permissionError(error)
      dispatch({ type: 'FAIL', code, message })
    }
  }, [settle, stopInput])

  useEffect(() => () => {
    window.clearTimeout(settlingTimerRef.current)
    stopInput()
  }, [stopInput])

  return { session, inputLevel, microphoneActive: Boolean(streamRef.current), start, stop: settle }
}

