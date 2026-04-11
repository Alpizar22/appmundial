import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

/**
 * Batch-fetches full profile data for a list of user IDs.
 * Returns { [userId]: { isPro, titulo, avatarEmoji } }
 */
export function useUserProfiles(userIds) {
  const [profiles, setProfiles] = useState({})
  const key = [...new Set(userIds)].filter(Boolean).sort().join(',')

  useEffect(() => {
    const ids = key.split(',').filter(Boolean)
    if (!ids.length) {
      setProfiles({})
      return
    }
    let cancelled = false
    supabase
      .from('profiles')
      .select('id, is_pro, titulo, avatar_emoji')
      .in('id', ids)
      .then(({ data }) => {
        if (!cancelled && data) {
          const map = {}
          for (const p of data) {
            map[p.id] = {
              isPro: !!p.is_pro,
              titulo: p.titulo || 'Coleccionista',
              avatarEmoji: p.avatar_emoji || '⚽',
            }
          }
          setProfiles(map)
        }
      })
    return () => {
      cancelled = true
    }
  }, [key])

  return profiles
}
