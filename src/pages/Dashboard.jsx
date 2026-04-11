import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { TOTAL_CARDS } from '../constants'
import { celebrateAlbumComplete } from '../lib/celebrateAlbum'
import { IconChat, IconGrid, IconLayers, IconSwap } from '../components/NavIcons'

export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useLang()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const prevUniqueRef = useRef(null)
  const celebrated100Ref = useRef(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('user_cards')
        .select('card_number, quantity')
        .eq('user_id', user.id)
      if (!cancelled) {
        if (!error && data) setRows(data)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user.id])

  const stats = useMemo(() => {
    const unique = rows.length
    const totalCopies = rows.reduce((s, r) => s + (r.quantity || 0), 0)
    const duplicateExtra = rows.reduce(
      (s, r) => s + Math.max(0, (r.quantity || 1) - 1),
      0
    )
    const pct = Math.round((unique / TOTAL_CARDS) * 1000) / 10
    return { unique, totalCopies, duplicateExtra, pct }
  }, [rows])

  useEffect(() => {
    if (loading) return
    const u = stats.unique
    const prev = prevUniqueRef.current
    prevUniqueRef.current = u
    if (u < TOTAL_CARDS) {
      celebrated100Ref.current = false
      return
    }
    if (celebrated100Ref.current) return
    const justCompleted = prev !== null && prev < TOTAL_CARDS
    const alreadyFullOnFirstLoad = prev === null && u === TOTAL_CARDS
    if (u === TOTAL_CARDS && (justCompleted || alreadyFullOnFirstLoad)) {
      celebrated100Ref.current = true
      celebrateAlbumComplete()
    }
  }, [loading, stats.unique])

  if (loading) {
    return (
      <div className="screen-loading">
        <div className="screen-loading__spinner" />
      </div>
    )
  }

  return (
    <div className="page dashboard">
      <header className="page-header">
        <h1>{t('dashboard_title')}</h1>
        <p>{t('dashboard_subtitle')}</p>
      </header>

      <div className="stat-grid">
        <article className="stat-card stat-card--highlight stat-card--album">
          <span className="stat-card__glow" aria-hidden="true" />
          <span className="stat-card__label">{t('stat_unique')}</span>
          <strong className="stat-card__value">
            {stats.unique}
            <small> / {TOTAL_CARDS}</small>
          </strong>
          <div
            className={`progress-bar progress-bar--animated${stats.unique >= TOTAL_CARDS ? ' progress-bar--complete' : ''}`}
            aria-hidden="true"
          >
            <div
              className="progress-bar__fill progress-bar__fill--shine"
              style={{ width: `${Math.min(100, stats.pct)}%` }}
            />
          </div>
          <span className="stat-card__hint">
            {stats.unique >= TOTAL_CARDS ? (
              <span className="stat-card__complete">{t('stat_complete')}</span>
            ) : (
              t('stat_pct_of_album', { pct: stats.pct })
            )}
          </span>
        </article>
        <article className="stat-card stat-card--copies">
          <span className="stat-card__glow stat-card__glow--blue" aria-hidden="true" />
          <span className="stat-card__label">{t('stat_total_copies')}</span>
          <strong className="stat-card__value">{stats.totalCopies}</strong>
          <span className="stat-card__hint">{t('stat_includes_dupes')}</span>
        </article>
        <article className="stat-card stat-card--dupstat">
          <span className="stat-card__glow stat-card__glow--red" aria-hidden="true" />
          <span className="stat-card__label">{t('stat_extra')}</span>
          <strong className="stat-card__value">{stats.duplicateExtra}</strong>
          <span className="stat-card__hint">{t('stat_for_trade')}</span>
        </article>
      </div>

      <section className="dashboard-actions">
        <h2>{t('quick_access')}</h2>
        <div className="action-cards">
          <Link className="action-card action-card--grid" to="/coleccion">
            <span className="action-card__icon-wrap" aria-hidden="true">
              <IconGrid className="action-card__svg" />
            </span>
            <div>
              <strong>{t('action_mark')}</strong>
              <p>{t('action_mark_desc', { total: TOTAL_CARDS })}</p>
            </div>
          </Link>
          <Link className="action-card action-card--layers" to="/duplicados">
            <span className="action-card__icon-wrap" aria-hidden="true">
              <IconLayers className="action-card__svg" />
            </span>
            <div>
              <strong>{t('action_dupes')}</strong>
              <p>{t('action_dupes_desc')}</p>
            </div>
          </Link>
          <Link className="action-card action-card--swap" to="/intercambios">
            <span className="action-card__icon-wrap" aria-hidden="true">
              <IconSwap className="action-card__svg" />
            </span>
            <div>
              <strong>{t('action_trades')}</strong>
              <p>{t('action_trades_desc')}</p>
            </div>
          </Link>
          <Link className="action-card action-card--chat" to="/chat">
            <span className="action-card__icon-wrap" aria-hidden="true">
              <IconChat className="action-card__svg" />
            </span>
            <div>
              <strong>{t('action_chat')}</strong>
              <p>{t('action_chat_desc')}</p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  )
}
