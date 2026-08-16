import Anthropic from '@anthropic-ai/sdk'
import { textToSpeech } from './_lib/elevenlabs.js'
import { consumeVoiceTurn } from './_lib/rate-limit.js'
import { stripMarkdown } from './_lib/sanitize.js'
import { VOICE_MAX_INPUT_CHARS, VOICE_MAX_TOKENS, VOICE_MAX_TTS_CHARS, VOICE_MODEL, VOICE_SYSTEM_PROMPT } from './_lib/voice-config.js'

export const config = { maxDuration: 30 }

let anthropic
const getAnthropic = () => {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('anthropic_not_configured')
  return (anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }))
}

function sendError(res, status, code, message, extra = {}) {
  return res.status(status).json({ error: { code, message }, ...extra })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return sendError(res, 405, 'method_not_allowed', 'Método no permitido.')
  }

  const rawMessage = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
  if (!rawMessage) return sendError(res, 400, 'empty_message', 'No se entendió el mensaje.')
  const message = rawMessage.slice(0, VOICE_MAX_INPUT_CHARS)

  let rate
  try {
    rate = await consumeVoiceTurn(req)
  } catch (error) {
    console.error('[voice] Rate limiter:', error instanceof Error ? error.message : 'unknown_error')
    return sendError(res, 503, 'rate_limit_unavailable', 'El asistente no está disponible temporalmente.')
  }
  res.setHeader('X-RateLimit-Limit', String(rate.limit))
  res.setHeader('X-RateLimit-Remaining', String(rate.remaining))
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfter))
    return sendError(res, 429, 'rate_limit_exceeded', 'Has alcanzado el límite de cinco conversaciones por hora.', { retryAfter: rate.retryAfter })
  }

  let text
  try {
    const response = await getAnthropic().messages.create({
      model: VOICE_MODEL,
      max_tokens: VOICE_MAX_TOKENS,
      system: VOICE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }],
    })
    text = stripMarkdown(response.content.filter(block => block.type === 'text').map(block => block.text).join(' '))
  } catch (error) {
    console.error('[voice] Claude:', error instanceof Error ? error.message : 'unknown_error')
    return sendError(res, 502, 'assistant_failed', 'No pude procesar tu pregunta. Intenta de nuevo.')
  }
  if (!text) return sendError(res, 502, 'empty_response', 'No pude procesar tu pregunta. Intenta de nuevo.')

  try {
    const spoken = text.slice(0, VOICE_MAX_TTS_CHARS)
    const { audio, mimeType } = await textToSpeech(spoken)
    return res.status(200).json({ text, audio: Buffer.from(audio).toString('base64'), mimeType })
  } catch (error) {
    console.error('[voice] TTS:', error instanceof Error ? error.message : 'unknown_error')
    return res.status(200).json({ text, audio: null, mimeType: null, warning: 'tts_unavailable' })
  }
}

