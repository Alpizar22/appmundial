import { speechToText } from './_lib/elevenlabs.js'
import { consumeVoiceTurn } from './_lib/rate-limit.js'
import { VOICE_MAX_AUDIO_BYTES } from './_lib/voice-config.js'

export const config = { maxDuration: 30 }

function sendError(res, status, code, message, extra = {}) {
  return res.status(status).json({ error: { code, message }, ...extra })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return sendError(res, 405, 'method_not_allowed', 'Método no permitido.')
  }

  const encoded = typeof req.body?.audio === 'string' ? req.body.audio : ''
  if (!encoded) return sendError(res, 400, 'empty_audio', 'No se recibió audio.')

  const audio = Buffer.from(encoded, 'base64')
  if (!audio.length) return sendError(res, 400, 'empty_audio', 'No se recibió audio.')
  if (audio.length > VOICE_MAX_AUDIO_BYTES) return sendError(res, 413, 'audio_too_large', 'El audio es demasiado largo.')

  // Cubo propio: transcribir y responder son dos llamadas por turno, y compartir cubo
  // consumiria dos de los cinco por cada conversacion.
  let rate
  try {
    rate = await consumeVoiceTurn(req, Date.now(), 'stt')
  } catch (error) {
    console.error('[stt] Rate limiter:', error instanceof Error ? error.message : 'unknown_error')
    return sendError(res, 503, 'rate_limit_unavailable', 'La transcripción no está disponible temporalmente.')
  }
  res.setHeader('X-RateLimit-Limit', String(rate.limit))
  res.setHeader('X-RateLimit-Remaining', String(rate.remaining))
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfter))
    return sendError(res, 429, 'rate_limit_exceeded', 'Has alcanzado el límite de cinco conversaciones por hora.', { retryAfter: rate.retryAfter })
  }

  try {
    const text = await speechToText(audio, typeof req.body?.mimeType === 'string' ? req.body.mimeType : '')
    if (!text) return sendError(res, 422, 'empty_transcript', 'No se entendió lo que dijiste. Intenta de nuevo.')
    return res.status(200).json({ text })
  } catch (error) {
    console.error('[stt] ElevenLabs:', error instanceof Error ? error.message : 'unknown_error')
    return sendError(res, 502, 'transcription_failed', 'No fue posible transcribir tu voz.')
  }
}
