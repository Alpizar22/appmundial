import { useCallback, useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { getCarta } from '../data/jugadores'

export default function DuplicatesPage() {
  const { user } = useAuth()
  const { t } = useLang()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('user_cards')
      .select('carta_id, cantidad')
      .eq('user_id', user.id)
      .gt('cantidad', 1)
      .order('carta_id')
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

  async function removeOneDuplicate(cartaId, currentQty) {
    const next = currentQty - 1
    if (next <= 0) return
    const { error: err } = await supabase
      .from('user_cards')
      .update({ cantidad: next })
      .eq('user_id', user.id)
      .eq('carta_id', cartaId)
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

  const totalExtra = rows.reduce((s, r) => s + (r.cantidad - 1), 0)

  return (
    <div className="page duplicates">
      <Helmet>
        <title>Mis repetidos – SoccerSticker | Gestión de cromos duplicados</title>
        <meta name="description" content="Gestiona tus cromos repetidos de fútbol. Conoce exactamente qué estampitas tienes de más para intercambiar con otros coleccionistas." />
        <meta property="og:title" content="Mis repetidos – SoccerSticker" />
        <meta property="og:description" content="Controla tus cromos duplicados de fútbol y prepárate para intercambiarlos." />
        <meta property="og:url" content="https://soccersticker.app/duplicados" />
      </Helmet>
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
              const { equipo, carta } = getCarta(r.carta_id)
              return (
                <li key={r.carta_id} className="dup-row">
                  <div>
                    <span className="dup-row__num">{equipo.bandera} #{carta.numero}</span>
                    <span className="dup-row__player">{carta.nombre}</span>
                    <span className="dup-row__qty">
                      {r.cantidad} {t('copies_label')} · {equipo.nombre}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => removeOneDuplicate(r.carta_id, r.cantidad)}
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
