// Vercel serverless function — Gemini 2.5 Flash (free tier)
// POST { momento_id, variable_id?, variable_custom?, lang } → { id, narrativa }

import { createClient } from '@supabase/supabase-js'

const MODEL = 'gemini-2.5-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const SYSTEM_ES = `Eres un narrador experto en fútbol. Genera una historia alterna corta (150-200 palabras) en tono periodístico/dramático sobre qué hubiera pasado si el escenario alterno ocurría en el momento histórico dado. Enfócate SOLO en las consecuencias inmediatas del partido (no décadas después). Usa nombres reales de jugadores y equipos (uso editorial). Hazlo emocionante y creíble. Devuelve SOLO el texto narrativo, sin títulos ni etiquetas.`

const SYSTEM_EN = `You are an expert football storyteller. Write a short alternate-history piece (150-200 words) in journalistic/dramatic tone about what would have happened if the alternate scenario occurred in the given historic moment. Focus ONLY on the immediate consequences of the match (not decades later). Use real player and team names (editorial use). Make it exciting and believable. Return ONLY the narrative text, no titles or labels.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.GEMINI_API_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' })
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase not configured' })

  const { momento_id, variable_id, variable_custom, lang = 'es' } = req.body || {}
  if (!momento_id) return res.status(400).json({ error: 'momento_id required' })
  if (!variable_id && !variable_custom) return res.status(400).json({ error: 'variable_id or variable_custom required' })
  if (variable_custom && (typeof variable_custom !== 'string' || variable_custom.length < 5 || variable_custom.length > 300)) {
    return res.status(400).json({ error: 'variable_custom must be 5–300 chars' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  // Fetch momento
  const { data: momento, error: mErr } = await supabase
    .from('momentos')
    .select('id, titulo, titulo_en, descripcion, año, equipos')
    .eq('id', momento_id)
    .single()
  if (mErr || !momento) return res.status(404).json({ error: 'momento not found' })

  // Fetch variable (if predefined)
  let variableText = variable_custom
  if (variable_id) {
    const { data: variable, error: vErr } = await supabase
      .from('variables')
      .select('id, texto, texto_en, momento_id')
      .eq('id', variable_id)
      .single()
    if (vErr || !variable) return res.status(404).json({ error: 'variable not found' })
    if (variable.momento_id !== momento_id) return res.status(400).json({ error: 'variable does not belong to momento' })
    variableText = lang === 'en' ? (variable.texto_en || variable.texto) : variable.texto
  }

  const momentoTitulo = lang === 'en' ? (momento.titulo_en || momento.titulo) : momento.titulo
  const systemInstruction = lang === 'en' ? SYSTEM_EN : SYSTEM_ES
  const userPrompt = lang === 'en'
    ? `Historic moment: ${momentoTitulo} (${momento.año})\nContext: ${momento.descripcion}\n\nAlternate scenario: ${variableText}\n\nWrite the alternate story now.`
    : `Momento histórico: ${momentoTitulo} (${momento.año})\nContexto: ${momento.descripcion}\n\nEscenario alterno: ${variableText}\n\nEscribe la historia alterna ahora.`

  try {
    const geminiRes = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
          maxOutputTokens: 500,
        },
      }),
    })

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      return res.status(502).json({ error: `Gemini error: ${errText.slice(0, 200)}` })
    }
    const data = await geminiRes.json()
    const narrativa = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!narrativa) return res.status(502).json({ error: 'Empty response from Gemini' })

    // Get user_id from Authorization header if present (optional)
    let userId = null
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
        userId = userData?.user?.id ?? null
      } catch { /* anon */ }
    }

    const { data: inserted, error: iErr } = await supabase
      .from('historias')
      .insert({
        momento_id,
        variable_id: variable_id || null,
        variable_custom: variable_id ? null : variable_custom,
        narrativa,
        user_id: userId,
      })
      .select('id')
      .single()

    if (iErr) return res.status(500).json({ error: `DB insert failed: ${iErr.message}` })

    return res.status(200).json({ id: inserted.id, narrativa })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' })
  }
}
