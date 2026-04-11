import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { getJugador } from '../data/jugadores'

export default function DuplicatesPage() {
  const { user } = useAuth()
  const { t } = useLang()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('user_cards')
      .select('card_number, quantity')
      .eq('user_id', user.id)
      .gt('quantity', 1)
      .order('card_number')
    if (err) setError(err.message)
    else {
      setRows(data || [])
      setError('')
    }
  }, [user.id])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      await refresh()
      if (alive) setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [refresh])

  async function removeOneDuplicate(cardNumber, currentQty) {
    const next = currentQty - 1
    if (next <= 0) return
    const { error: err } = await supabase
      .from('user_cards')
      .update({ quantity: next })
      .eq('user_id', user.id)
      .eq('card_number', cardNumber)
    if (err) setError(err.message)
    else await refresh()
  }

  if (loading) {
    return (
      <div className="screen-loading">
        <div className="screen-loading__spinner" />
      </div>
    )
  }

  const totalExtra = rows.reduce((s, r) => s + (r.quantity - 1), 0)

  return (
    <div className="page duplicates">
      <header className="page-header">
        <h1>{t('duplicates_title')}</h1>
        <p>{t('duplicates_subtitle')}</p>
      </header>

      {error && <p className="form-error">{error}</p>}

      {rows.length === 0 ? (
        <div className="empty-state">
          <p>{t('duplicates_empty')}</p>
          <p className="empty-state__hint">
            {t('duplicates_hint_p1')} <kbd>{t('duplicates_kbd')}</kbd>{' '}
            {t('duplicates_hint_p2')}
          </p>
        </div>
      ) : (
        <>
          <p className="dup-summary">
            <strong>{totalExtra}</strong> {t('dup_summary_between')}{' '}
            <strong>{rows.length}</strong> {t('dup_summary_suffix')}
          </p>
          <ul className="dup-list">
            {rows.map((r) => {
              const j = getJugador(r.card_number)
              return (
                <li key={r.card_number} className="dup-row">
                  <div>
                    <span className="dup-row__num">{t('card_number', { n: r.card_number })}</span>
                    <span className="dup-row__player">{j.nombre}</span>
                    <span className="dup-row__qty">
                      {r.quantity} {t('copies_label')} · {j.pais}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => removeOneDuplicate(r.card_number, r.quantity)}
                  >
                    {t('btn_remove_extra')}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
