import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (import.meta.env.DEV && (!supabaseUrl || !supabaseKey)) {
  console.warn(
    '[appmundial] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env — las llamadas a Supabase fallarán.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)