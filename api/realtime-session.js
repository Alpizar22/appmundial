import { consumeVoiceTurn } from './_lib/rate-limit.js'
import { OPENAI_REALTIME_MODEL, OPENAI_REALTIME_VOICE, REALTIME_INSTRUCTIONS, REALTIME_SECONDS_LIMIT_PER_HOUR, REALTIME_SESSION_SECONDS, REALTIME_TURN_DETECTION } from './_lib/voice-config.js'

export const config = { maxDuration: 15 }

// Mints a short-lived ("ephemeral") client secret the browser can use to open a WebRTC
// connection directly to OpenAI Realtime — this server never touches the audio itself.
// This is the ONLY server hop per conversation now: everything else (VAD, turn-taking,
// the model's response, its spoken audio) happens over the live session between the
// browser and OpenAI.
//
// Request/response shape verified against:
// https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets
//
// El limitador cobra REALTIME_SESSION_SECONDS (la duracion maxima que se le reserva a esta
// sesion) contra un presupuesto de segundos/hora, no 1 por request — una sesion Realtime
// cuesta segun cuanto dura, asi que el limite tiene que reflejar esa exposicion de costo,
// no la cantidad de veces que se llamo al endpoint. Ver REALTIME_SESSION_SECONDS/
// REALTIME_SECONDS_LIMIT_PER_HOUR en voice-config.js.

function sendError(res, status, code, message, extra = {}) {
  return res.status(status).json({ error: { code, message }, ...extra })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return sendError(res, 405, 'method_not_allowed', 'Método no permitido.')
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return sendError(res, 503, 'realtime_not_configured', 'El asistente de voz no está disponible temporalmente.')

  let rate
  try {
    rate = await consumeVoiceTurn(req, Date.now(), 'realtime-session', REALTIME_SESSION_SECONDS, REALTIME_SECONDS_LIMIT_PER_HOUR)
  } catch (error) {
    console.error('[realtime] Rate limiter:', error instanceof Error ? error.message : 'unknown_error')
    return sendError(res, 503, 'rate_limit_unavailable', 'El asistente no está disponible temporalmente.')
  }
  res.setHeader('X-RateLimit-Limit', String(rate.limit))
  res.setHeader('X-RateLimit-Remaining', String(rate.remaining))
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfter))
    return sendError(res, 429, 'rate_limit_exceeded', 'Has alcanzado tu límite de minutos de voz por hora.', { retryAfter: rate.retryAfter })
  }

  try {
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expires_after: { anchor: 'created_at', seconds: REALTIME_SESSION_SECONDS },
        session: {
          type: 'realtime',
          model: OPENAI_REALTIME_MODEL,
          instructions: REALTIME_INSTRUCTIONS,
          output_modalities: ['audio'],
          audio: {
            input: {
              format: { type: 'audio/pcm', rate: 24000 },
              turn_detection: REALTIME_TURN_DETECTION,
            },
            output: {
              format: { type: 'audio/pcm', rate: 24000 },
              voice: OPENAI_REALTIME_VOICE,
            },
          },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`session_mint_failed:${response.status}`)
    const payload = await response.json()
    const clientSecret = payload?.value
    if (!clientSecret) throw new Error('session_mint_empty')
    return res.status(200).json({
      clientSecret,
      expiresAt: payload.expires_at ?? null,
      model: OPENAI_REALTIME_MODEL,
    })
  } catch (error) {
    console.error('[realtime] OpenAI session mint:', error instanceof Error ? error.message : 'unknown_error')
    return sendError(res, 502, 'realtime_session_failed', 'No fue posible iniciar la sesión de voz. Intenta de nuevo.')
  }
}
