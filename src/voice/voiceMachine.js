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
// PROCESSING no entra: con GPT-Live es un estado inferido (la persona dejo de hablar y aun no
// suena la respuesta) y el propio hook lo devuelve a LISTENING si la respuesta no llega.
export const TRANSIENT_STATUSES = Object.freeze([VOICE_STATUS.ACTIVATING])

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
    // GPT-Live es una conversacion continua: al terminar de hablar el agente se vuelve a escuchar.
    case 'PLAYBACK_ENDED': return { ...state, status: VOICE_STATUS.LISTENING }
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
