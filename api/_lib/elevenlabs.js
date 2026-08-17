const BASE_URL = 'https://api.elevenlabs.io/v1/text-to-speech'
const STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text'
const DEFAULT_MODEL = 'eleven_multilingual_v2'
const DEFAULT_STT_MODEL = 'scribe_v2'

export async function speechToText(audio, mimeType) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('stt_not_configured')

  const form = new FormData()
  form.append('model_id', process.env.ELEVENLABS_STT_MODEL_ID || DEFAULT_STT_MODEL)
  form.append('language_code', 'es')
  form.append('file', new Blob([audio], { type: mimeType || 'audio/webm' }), 'turn.webm')

  const response = await fetch(STT_URL, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, accept: 'application/json' },
    body: form,
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`stt_failed:${response.status}`)
  const payload = await response.json()
  return typeof payload?.text === 'string' ? payload.text.trim() : ''
}

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

