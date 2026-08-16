export const VOICE_STATUS = Object.freeze({
  IDLE: 'idle',
  ACTIVATING: 'activating',
  LISTENING: 'listening',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
  SETTLING: 'settling',
  ERROR: 'error',
})

export const initialVoiceSession = Object.freeze({ status: VOICE_STATUS.IDLE, transcript: '', responseText: '', error: null })

export function voiceSessionReducer(state, action) {
  switch (action.type) {
    case 'ACTIVATE': return { ...initialVoiceSession, status: VOICE_STATUS.ACTIVATING }
    case 'PERMISSION_GRANTED': return { ...state, status: VOICE_STATUS.LISTENING, error: null }
    case 'TRANSCRIPT_READY': return { ...state, status: VOICE_STATUS.THINKING, transcript: action.transcript || '' }
    case 'RESPONSE_READY': return { ...state, status: VOICE_STATUS.SPEAKING, responseText: action.text || '' }
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
  return { activating: 'Activando…', listening: 'Escuchando…', thinking: 'Pensando…', speaking: 'Hablando…', settling: 'Finalizando…', idle: '' }[session.status] || ''
}

