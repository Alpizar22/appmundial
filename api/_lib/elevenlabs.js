const BASE_URL = 'https://api.elevenlabs.io/v1/text-to-speech'
const DEFAULT_MODEL = 'eleven_multilingual_v2'

export async function textToSpeech(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const voiceId = process.env.ELEVENLABS_VOICE_ID
  if (!apiKey || !voiceId) throw new Error('tts_not_configured')

  const response = await fetch(`${BASE_URL}/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'content-type': 'application/json',
      accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL,
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`tts_failed:${response.status}`)
  return { audio: await response.arrayBuffer(), mimeType: 'audio/mpeg' }
}

