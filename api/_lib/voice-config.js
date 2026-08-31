// --- OpenAI Realtime (voice-to-voice) ---------------------------------------------------
// Shape verified against https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets
// (2026-08-31). Re-check before shipping if OpenAI's docs have moved on since.
export const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime'
export const OPENAI_REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || 'verse'

// Techo de duracion por sesion (expires_after.seconds al mintear el token). La sesion ya se
// cierra sola al terminar response.done (un intercambio por toque, ver useVoiceAssistant.js),
// asi que este valor es solo el margen de seguridad para ESE intercambio, no una conversacion
// larga — no hace falta reservar los 600s (10 min) que tendria sentido para una sesion
// continua de varios turnos.
export const REALTIME_SESSION_SECONDS = Number(process.env.REALTIME_SESSION_SECONDS) || 180
// Presupuesto de segundos reservados por IP por hora (ver api/_lib/rate-limit.js): cobra por
// la exposicion de costo maxima de cada sesion, no por cuantas veces se llamo al endpoint.
// 900s = 5 sesiones de REALTIME_SESSION_SECONDS. Ajustar segun el costo real por minuto de
// OpenAI Realtime y cuanto quiera absorber el negocio — no hay un numero "correcto" universal.
export const REALTIME_SECONDS_LIMIT_PER_HOUR = Number(process.env.REALTIME_SECONDS_LIMIT_PER_HOUR) || REALTIME_SESSION_SECONDS * 5

// Server-side VAD tuning (session.audio.input.turn_detection). `threshold` (0-1) is
// mic-energy sensitivity — lower catches quieter speech but also more background noise;
// `prefix_padding_ms` keeps a bit of audio before the detected speech onset so the first
// word isn't clipped; `silence_duration_ms` is how long the user must be silent before the
// turn is considered over (the equivalent of the old SILENCE_HOLD_MS, now enforced
// server-side instead of by our own RMS loop). `type: 'semantic_vad'` with an `eagerness`
// field is the alternative mode if `server_vad`'s fixed silence window proves too twitchy
// on background noise/coughs — see the Phase 4 notes.
export const REALTIME_TURN_DETECTION = {
  type: 'server_vad',
  threshold: 0.5,
  prefix_padding_ms: 300,
  silence_duration_ms: 700,
  create_response: true,
  interrupt_response: true,
}

export const REALTIME_INSTRUCTIONS = `Eres el asistente de voz de Nasus Labs, un estudio de soluciones tecnológicas a medida. Respondes preguntas sobre inteligencia artificial, automatización, WhatsApp, desarrollo web y sistemas de datos. Eres directo, profesional y cálido. Tus respuestas son breves, con un máximo de tres oraciones, porque se escuchan en voz.

No uses markdown, encabezados, viñetas ni símbolos de formato — hablas, no escribes. Si preguntan por precios o proyectos específicos, invita a contactar directamente con Nasus Labs. Responde siempre en español.`
