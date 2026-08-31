export const VOICE_STATUS = Object.freeze({
  IDLE: 'idle',
  ACTIVATING: 'activating',
  LISTENING: 'listening',
  TRANSCRIBING: 'transcribing',
  PROCESSING: 'processing',
  GENERATING_VOICE: 'generating_voice',
  SPEAKING: 'speaking',
  SETTLING: 'settling',
  ERROR: 'error',
})

// Estados en los que la sesion esta trabajando y podria quedarse colgada si una peticion
// nunca resuelve. El vigilante global del hook los usa como red de seguridad.
export const TRANSIENT_STATUSES = Object.freeze([
  VOICE_STATUS.ACTIVATING,
  VOICE_STATUS.TRANSCRIBING,
  VOICE_STATUS.PROCESSING,
  VOICE_STATUS.GENERATING_VOICE,
])

export const initialVoiceSession = Object.freeze({ status: VOICE_STATUS.IDLE, transcript: '', responseText: '', error: null })

export function voiceSessionReducer(state, action) {
  switch (action.type) {
    case 'ACTIVATE': return { ...initialVoiceSession, status: VOICE_STATUS.ACTIVATING }
    case 'PERMISSION_GRANTED': return { ...state, status: VOICE_STATUS.LISTENING, error: null }
    // La sesion Realtime dispara response.created en cuanto el VAD del servidor decide que el
    // turno termino: no hay un paso de transcripcion/espera separado que nosotros controlemos,
    // asi que se salta TRANSCRIBING y se va directo a PROCESSING.
    case 'RESPONSE_STARTED': return { ...state, status: VOICE_STATUS.PROCESSING }
    // input_audio_buffer.speech_started del servidor. Si ya estabamos hablando (el usuario
    // interrumpio a mitad de respuesta), esto es la señal de barge-in: OpenAI corta el audio en
    // curso del lado del servidor (interrupt_response:true) y aqui solo reflejamos el estado.
    // Si ya estabamos escuchando, es un no-op.
    case 'SPEECH_STARTED': return { ...state, status: VOICE_STATUS.LISTENING }
    case 'PLAYBACK_STARTED': return { ...state, status: VOICE_STATUS.SPEAKING }
    case 'PLAYBACK_ENDED':
    case 'STOP': return { ...state, status: VOICE_STATUS.SETTLING }
    case 'SETTLED':
    case 'RESET': return { ...initialVoiceSession }
    case 'FAIL': return { ...state, status: VOICE_STATUS.ERROR, error: { code: action.code || 'unknown_error', message: action.message || 'No fue posible continuar.' } }
    default: return state
  }
}

export function voiceStateLabel(session) {
  if (session.status === VOICE_STATUS.ERROR) return session.error?.message || 'Error de conexión'
  return {
    activating: 'Activando…',
    listening: 'Escuchando…',
    transcribing: 'Transcribiendo…',
    processing: 'Pensando…',
    generating_voice: 'Preparando voz…',
    speaking: 'Hablando…',
    settling: 'Finalizando…',
    idle: '',
  }[session.status] || ''
}
