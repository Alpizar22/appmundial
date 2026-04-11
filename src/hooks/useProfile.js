import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    let cancelled = false
    supabase
      .from('profiles')
      .select('is_pro, pro_since')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setProfile(data ?? { is_pro: false, pro_since: null })
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [user])

  return { profile, loading, isPro: profile?.is_pro ?? false }
}
