import { consumeBudget, consumeVoiceTurn, refundBudget } from './_lib/rate-limit.js'
import { LIVE_BACKEND_INSTRUCTIONS, LIVE_BACKEND_MODEL, LIVE_DAILY_SECONDS, LIVE_IDLE_TIMEOUT_S, LIVE_INSTRUCTIONS, LIVE_MODEL, LIVE_MONTHLY_SECONDS, LIVE_SECONDS_LIMIT_PER_HOUR, LIVE_SESSION_SECONDS, LIVE_VOICE } from './_lib/voice-config.js'

export const config = { maxDuration: 30 }

const OPENAI_LIVE_URL = 'https://api.openai.com/v1/live/sessions'
const MAX_SDP_CHARS = 32_000

// Abre una sesion de voz con GPT-Live. El navegador manda su oferta WebRTC (SDP) y este
// endpoint la intercambia con OpenAI con la llave del servidor. Antes de llamar a OpenAI se
// reserva presupuesto (por IP/hora y global por dia/mes); si algo falla, se devuelve.
// Falla cerrado: sin llave o sin Redis no se abre ninguna sesion.
function fail(res, status, code, message) {
  return res.status(status).json({ error: { code, message } })
}

const sameOrigin = req => {
  try { return !!req.headers.origin && !!req.headers.host && new URL(req.headers.origin).host === req.headers.host } catch { return false }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 405, 'method_not_allowed', 'Método no permitido.') }
  if (!sameOrigin(req)) return fail(res, 403, 'origin', 'Origen no permitido.')

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return fail(res, 503, 'live_not_configured', 'El asistente de voz no está disponible temporalmente.')

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = null } }
  const sdp = typeof body?.sdp === 'string' ? body.sdp : ''
  if (!sdp.startsWith('v=0') || sdp.length > MAX_SDP_CHARS) return fail(res, 400, 'bad_request', 'Solicitud inválida.')

  const now = Date.now()
  const day = new Date(now).toISOString().slice(0, 10)
  const month = day.slice(0, 7)
  const dayKey = `live:day:${day}`
  const monthKey = `live:month:${month}`
  const reserved = []

  const release = () => Promise.all(reserved.map(key => refundBudget(key, LIVE_SESSION_SECONDS)))

  try {
    const rate = await consumeVoiceTurn(req, now, 'live-session', LIVE_SESSION_SECONDS, LIVE_SECONDS_LIMIT_PER_HOUR)
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfter))
      return fail(res, 429, 'rate_limit_exceeded', 'Has alcanzado tu límite de minutos de voz por hora.')
    }
    const daily = await consumeBudget(dayKey, 2 * 86_400, LIVE_SESSION_SECONDS, LIVE_DAILY_SECONDS)
    reserved.push(dayKey)
    if (!daily.allowed) { await release(); return fail(res, 429, 'busy', 'El asistente de voz tiene mucha demanda ahora. Escríbenos por WhatsApp.') }
    const monthly = await consumeBudget(monthKey, 35 * 86_400, LIVE_SESSION_SECONDS, LIVE_MONTHLY_SECONDS)
    reserved.push(monthKey)
    if (!monthly.allowed) { await release(); return fail(res, 429, 'busy', 'El asistente de voz tiene mucha demanda ahora. Escríbenos por WhatsApp.') }
  } catch (error) {
    await release()
    console.error('[live] Rate limiter:', error instanceof Error ? error.message : 'unknown_error')
    return fail(res, 503, 'rate_limit_unavailable', 'El asistente no está disponible temporalmente.')
  }

  let upstream
  try {
    upstream = await fetch(OPENAI_LIVE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: {
          model: LIVE_MODEL,
          instructions: LIVE_INSTRUCTIONS,
          audio: { output: { voice: LIVE_VOICE } },
          // Espera a que la persona hable y pasa a espera (mas barata) si hay silencio.
          wake_policy: { type: 'speech' },
          idle_timeout_s: LIVE_IDLE_TIMEOUT_S,
          delegation: { type: 'responses', responses: { model: LIVE_BACKEND_MODEL, instructions: LIVE_BACKEND_INSTRUCTIONS } },
        },
        transport: { type: 'webrtc', sdp },
      }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    await release()
    console.error('[live] OpenAI fetch:', error instanceof Error ? error.message : 'unknown_error')
    return fail(res, 502, 'live_session_failed', 'No fue posible iniciar la sesión de voz. Intenta de nuevo.')
  }

  if (!upstream.ok) {
    await release()
    // Solo status y codigos de error de OpenAI (p. ej. insufficient_quota): el cuerpo puede incluir el SDP.
    let code = ''
    try { const data = await upstream.json(); code = [data?.error?.code, data?.error?.type].filter(v => typeof v === 'string').join('/').slice(0, 80) } catch { /* sin cuerpo */ }
    console.error('[live] OpenAI status:', upstream.status, code)
    return fail(res, 502, 'live_session_failed', 'No fue posible iniciar la sesión de voz. Intenta de nuevo.')
  }

  let answer
  try { answer = (await upstream.json())?.transport?.sdp } catch { answer = undefined }
  if (!answer) {
    await release()
    console.error('[live] respuesta de OpenAI sin SDP')
    return fail(res, 502, 'live_session_failed', 'No fue posible iniciar la sesión de voz. Intenta de nuevo.')
  }
  return res.status(201).json({ sdp: answer, maxSeconds: LIVE_SESSION_SECONDS })
}
