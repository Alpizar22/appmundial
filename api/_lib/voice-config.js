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

// Server-side turn detection (session.audio.input.turn_detection). Two modes, pick ONE by
// changing which constant REALTIME_TURN_DETECTION points to at the bottom of this block —
// both are kept fully written out so switching back and forth while testing is a one-line
// change, not a rewrite.
//
// SEMANTIC_VAD (default): the model itself judges whether the user actually finished a
// thought, instead of reacting to a fixed volume threshold — this is what makes it
// tolerant of background noise, short coughs, or a pause mid-sentence, none of which read
// as "done talking" semantically the way they do to a raw amplitude gate.
//   - `eagerness`: the only knob. 'low' waits longer / needs more confidence before
//     deciding the user is done (most tolerant of noise — use this if it's still cutting
//     too eagerly). 'high' cuts faster (more responsive, but closer to server_vad's
//     twitchiness). 'auto' lets OpenAI balance it. 'medium' is in between.
//
// SERVER_VAD (fallback): a fixed mic-energy threshold, same style as the original
// client-side VAD this replaced. Use this instead if semantic_vad's server-side judgment
// call ever feels wrong for this use case, or you want deterministic, purely
// volume-based behavior.
//   - `threshold` (0-1): mic-energy sensitivity. RAISE this if quiet background noise
//     keeps triggering speech detection (less sensitive to soft sounds); LOWER it if the
//     user's own quiet speech isn't being picked up.
//   - `silence_duration_ms`: how long the user must be silent before the turn is
//     considered over. RAISE this to give more room for pauses/coughs mid-sentence
//     without ending the turn (trades off against making the assistant wait longer after
//     the user actually finishes).
//   - `prefix_padding_ms`: audio kept before the detected speech onset, so the first word
//     isn't clipped. Rarely needs tuning.
const REALTIME_TURN_DETECTION_SEMANTIC_VAD = {
  type: 'semantic_vad',
  eagerness: 'low',
  create_response: true,
  interrupt_response: true,
}
const REALTIME_TURN_DETECTION_SERVER_VAD = {
  type: 'server_vad',
  threshold: 0.65,          // subido desde .5 — menos sensible a ruido de fondo bajo
  prefix_padding_ms: 300,
  silence_duration_ms: 900, // subido desde 700 — mas margen antes de cerrar el turno
  create_response: true,
  interrupt_response: true,
}
export const REALTIME_TURN_DETECTION = REALTIME_TURN_DETECTION_SEMANTIC_VAD
// Para volver a server_vad: export const REALTIME_TURN_DETECTION = REALTIME_TURN_DETECTION_SERVER_VAD

export const REALTIME_INSTRUCTIONS = `Eres el asistente de voz de Nasus Labs, un estudio de soluciones tecnológicas a medida. Respondes preguntas sobre inteligencia artificial, automatización, WhatsApp, desarrollo web y sistemas de datos. Eres directo, profesional y cálido. Tus respuestas son breves, con un máximo de tres oraciones, porque se escuchan en voz.

No uses markdown, encabezados, viñetas ni símbolos de formato — hablas, no escribes. Si preguntan por precios o proyectos específicos, invita a contactar directamente con Nasus Labs. Responde siempre en español.`
