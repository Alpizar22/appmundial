import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

/** Batch-fetches Pro status for a list of user IDs. Returns { [userId]: boolean }. */
export function useProStatuses(userIds) {
  const [statuses, setStatuses] = useState({})
  // Stable key to avoid infinite loops
  const key = [...new Set(userIds)].filter(Boolean).sort().join(',')

  useEffect(() => {
    const ids = key.split(',').filter(Boolean)
    if (!ids.length) {
      setStatuses({})
      return
    }
    let cancelled = false
    supabase
      .from('profiles')
      .select('id, is_pro')
      .in('id', ids)
      .then(({ data }) => {
        if (!cancelled && data) {
          const map = {}
          for (const p of data) {
            map[p.id] = !!p.is_pro
          }
          setStatuses(map)
        }
      })
    return () => {
      cancelled = true
    }
  }, [key])

  return statuses
}
