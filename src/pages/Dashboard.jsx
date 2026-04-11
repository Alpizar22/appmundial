import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { useProfile } from '../hooks/useProfile'
import { TOTAL_CARDS } from '../constants'
import { celebrateAlbumComplete } from '../lib/celebrateAlbum'
import { getJugador } from '../data/jugadores'
import { IconChat, IconGrid, IconLayers, IconSwap } from '../components/NavIcons'

const COMMON_THRESHOLD = 600 // cards 1-600 common, 601-800 rare

function getOrUpdateStreak() {
  const KEY = 'ss_streak'
  const today = new Date().toISOString().slice(0, 10)
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '{}')
    const { last, streak = 0 } = stored
    if (last === today) return streak || 1
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const newStreak = last === yesterday.toISOString().slice(0, 10) ? streak + 1 : 1
    localStorage.setItem(KEY, JSON.stringify({ last: today, streak: newStreak }))
    return newStreak
  } catch {
    return 1
  }
}

export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useLang()
  const { isPro } = useProfile()
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

  const proStats = useMemo(() => {
    if (!isPro || loading) return null
    const ownedSet = new Set(rows.map((r) => r.card_number))

    // Hardest missing card (highest-numbered rare first, then common)
    let hardestMissing = null
    for (let n = TOTAL_CARDS; n >= 1; n--) {
      if (!ownedSet.has(n)) {
        hardestMissing = n
        break
      }
    }

    // Rarity distribution
    const commonOwned = rows.filter((r) => r.card_number <= COMMON_THRESHOLD).length
    const rareOwned = rows.filter((r) => r.card_number > COMMON_THRESHOLD).length
    const commonTotal = COMMON_THRESHOLD
    const rareTotal = TOTAL_CARDS - COMMON_THRESHOLD
    const commonPct = Math.round((commonOwned / commonTotal) * 100)
    const rarePct = Math.round((rareOwned / rareTotal) * 100)

    // Estimated packs to complete
    const missing = TOTAL_CARDS - rows.length
    let estimatedPacks = 0
    if (missing > 0) {
      const pctMissing = missing / TOTAL_CARDS
      estimatedPacks = Math.ceil(missing / Math.max(5 * pctMissing, 0.25))
    }

    // Country progress (group by pais)
    const countryMap = {}
    for (let n = 1; n <= TOTAL_CARDS; n++) {
      const j = getJugador(n)
      if (!countryMap[j.pais]) countryMap[j.pais] = { total: 0, owned: 0 }
      countryMap[j.pais].total++
      if (ownedSet.has(n)) countryMap[j.pais].owned++
    }
    const countries = Object.entries(countryMap)
      .map(([pais, d]) => ({ pais, ...d, pct: d.total ? Math.round((d.owned / d.total) * 100) : 0 }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 8)

    // Streak
    const streak = getOrUpdateStreak()

    return {
      hardestMissing,
      commonOwned,
      rareOwned,
      commonTotal,
      rareTotal,
      commonPct,
      rarePct,
      estimatedPacks,
      countries,
      streak,
    }
  }, [rows, isPro, loading])

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

      {/* —— Pro Dashboard —— */}
      {isPro && proStats ? (
        <section className="pro-dashboard">
          <h2 className="pro-dashboard__title">
            <span className="pro-badge">{t('pro_badge')}</span>{' '}
            {t('pro_dashboard_title')}
          </h2>
          <div className="pro-dashboard__grid">
            {/* Hardest missing card */}
            <article className="pro-stat-card">
              <span className="pro-stat-card__label">{t('pro_hardest_title')}</span>
              {proStats.hardestMissing ? (
                <strong className="pro-stat-card__value">
                  #{proStats.hardestMissing}
                  <small className="pro-stat-card__sub">
                    {' '}
                    {getJugador(proStats.hardestMissing).nombre}
                  </small>
                </strong>
              ) : (
                <strong className="pro-stat-card__value pro-stat-card__value--complete">
                  {t('pro_hardest_none')}
                </strong>
              )}
            </article>

            {/* Estimated packs */}
            <article className="pro-stat-card">
              <span className="pro-stat-card__label">{t('pro_packs_title')}</span>
              <strong className="pro-stat-card__value">
                {proStats.estimatedPacks === 0
                  ? t('pro_packs_complete')
                  : t('pro_packs_value', { n: proStats.estimatedPacks })}
              </strong>
            </article>

            {/* Streak */}
            <article className="pro-stat-card">
              <span className="pro-stat-card__label">{t('pro_streak_title')}</span>
              <strong className="pro-stat-card__value">
                🔥{' '}
                {proStats.streak === 1
                  ? t('pro_streak_days', { n: proStats.streak })
                  : t('pro_streak_days_plural', { n: proStats.streak })}
              </strong>
            </article>

            {/* Common vs Rare */}
            <article className="pro-stat-card pro-stat-card--wide">
              <span className="pro-stat-card__label">{t('pro_rarity_title')}</span>
              <div className="pro-rarity">
                <div className="pro-rarity__row">
                  <span>{t('pro_rarity_common', { pct: proStats.commonPct })}</span>
                  <span>
                    {proStats.commonOwned}/{proStats.commonTotal}
                  </span>
                </div>
                <div className="pro-rarity__bar">
                  <div
                    className="pro-rarity__fill pro-rarity__fill--common"
                    style={{ width: `${proStats.commonPct}%` }}
                  />
                </div>
                <div className="pro-rarity__row">
                  <span>{t('pro_rarity_rare', { pct: proStats.rarePct })}</span>
                  <span>
                    {proStats.rareOwned}/{proStats.rareTotal}
                  </span>
                </div>
                <div className="pro-rarity__bar">
                  <div
                    className="pro-rarity__fill pro-rarity__fill--rare"
                    style={{ width: `${proStats.rarePct}%` }}
                  />
                </div>
              </div>
            </article>
          </div>

          {/* Country progress chart */}
          <div className="pro-countries">
            <h3 className="pro-countries__title">{t('pro_countries_title')}</h3>
            <div className="pro-countries__list">
              {proStats.countries.map(({ pais, owned, total, pct }) => (
                <div key={pais} className="pro-country-row">
                  <span className="pro-country-row__name">{pais}</span>
                  <div className="pro-country-row__bar-wrap">
                    <div
                      className="pro-country-row__bar"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="pro-country-row__pct">{pct}%</span>
                  <span className="pro-country-row__count">
                    {owned}/{total}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : !isPro ? (
        <section className="feature-locked">
          <span className="feature-locked__icon">🔒</span>
          <div>
            <strong className="feature-locked__title">{t('pro_locked_title')}</strong>
            <p className="feature-locked__desc">{t('pro_locked_desc')}</p>
          </div>
          <Link to="/premium" className="btn btn--primary btn--sm">
            {t('pro_locked_btn')}
          </Link>
        </section>
      ) : null}

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
