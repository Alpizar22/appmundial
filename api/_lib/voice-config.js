// --- OpenAI GPT-Live (voz en vivo por WebRTC) -------------------------------------------
// Mismo patron que nasus.lat: el navegador manda su oferta SDP a /api/live-session y el
// servidor la intercambia con OpenAI usando OPENAI_API_KEY (nunca llega al cliente).
// Precio de referencia: US$0.05 por minuto activo; el modelo "backend" cuesta centavos.
// Los topes se ajustan con variables de entorno, sin tocar codigo. El tope DURO de gasto es
// el limite mensual del proyecto en el panel de OpenAI; esto es la primera linea de defensa.
const intFromEnv = (name, fallback, min, max) => {
  const n = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback
}

export const LIVE_MODEL = process.env.LIVE_MODEL || 'gpt-live-1.1'
export const LIVE_BACKEND_MODEL = process.env.LIVE_BACKEND_MODEL || 'gpt-5.6-luna'
export const LIVE_VOICE = process.env.LIVE_VOICE || 'marin'

// Segundos que se reservan por sesion y que el cliente respeta como maximo.
export const LIVE_SESSION_SECONDS = intFromEnv('LIVE_SESSION_SECONDS', 90, 30, 300)
// Tras cuantos segundos sin voz la sesion pasa a espera (mas barata).
export const LIVE_IDLE_TIMEOUT_S = 15
// Segundos reservados por IP por hora (4 sesiones completas por defecto).
export const LIVE_SECONDS_LIMIT_PER_HOUR = intFromEnv('LIVE_SECONDS_LIMIT_PER_HOUR', LIVE_SESSION_SECONDS * 4, 30, 100_000)
// Segundos reservados en total por dia / por mes: 2400 s = 40 min ~ US$2; 9000 s = 150 min ~ US$7.5.
export const LIVE_DAILY_SECONDS = intFromEnv('LIVE_DAILY_SECONDS', 2400, 60, 100_000)
export const LIVE_MONTHLY_SECONDS = intFromEnv('LIVE_MONTHLY_SECONDS', 9000, 60, 1_000_000)

export const LIVE_INSTRUCTIONS = `Eres el asistente de voz de Nasus, una agencia mexicana de soluciones tecnologicas artesanales. Respondes preguntas sobre inteligencia artificial, automatizacion, WhatsApp, desarrollo web y sistemas de datos. Eres directo, profesional y calido, como una persona real en una llamada. Tus respuestas son breves, con un maximo de tres oraciones, porque se escuchan en voz; deja que la persona hable y, si te interrumpe, para y escuchala.

No uses markdown, encabezados, vinetas ni simbolos de formato: hablas, no escribes. Si preguntan por precios o proyectos especificos, no inventes cifras: invitalos a escribir por WhatsApp al 33 2914 2391 o entrar a nasus.lat. Responde en el idioma en que te hable la persona; si no queda claro, usa espanol de Mexico.`

export const LIVE_BACKEND_INSTRUCTIONS = `Respondes dudas sobre Nasus para una conversacion hablada: respuestas breves, claras y sin formato. Servicios: CRM con agentes de IA, automatizacion de procesos, asistentes de WhatsApp, paginas web y apps a la medida, y sistemas de datos. No inventes precios ni plazos; para eso, WhatsApp 33 2914 2391 o nasus.lat.`
