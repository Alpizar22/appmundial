import { supabase } from '../supabase'

export async function fetchMomentos() {
  const { data, error } = await supabase
    .from('momentos')
    .select('id, slug, titulo, titulo_en, descripcion, año, equipos, tags, imagen_emoji')
    .eq('activo', true)
    .order('orden', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function fetchMomentoBySlug(slug) {
  const { data, error } = await supabase
    .from('momentos')
    .select('id, slug, titulo, titulo_en, descripcion, año, equipos, tags, imagen_emoji, variables(id, texto, texto_en, tipo)')
    .eq('slug', slug)
    .eq('activo', true)
    .single()
  if (error) throw error
  return data
}

export async function fetchHistoria(id) {
  const { data, error } = await supabase
    .from('historias')
    .select('id, narrativa, variable_custom, compartidas, likes, created_at, momento:momentos(id, slug, titulo, titulo_en, descripcion, año, equipos, imagen_emoji), variable:variables(id, texto, texto_en)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function fetchHistoriasRecientes(limit = 20) {
  const { data, error } = await supabase
    .from('historias')
    .select('id, narrativa, variable_custom, created_at, compartidas, momento:momentos(id, slug, titulo, titulo_en, imagen_emoji), variable:variables(id, texto, texto_en)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function generarHistoria({ momento_id, variable_id, variable_custom, lang }) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/generar-historia', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ momento_id, variable_id, variable_custom, lang }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function incrementarCompartidas(historia_id) {
  try { await supabase.rpc('incrementar_compartidas', { historia_id }) } catch { /* silent */ }
}
