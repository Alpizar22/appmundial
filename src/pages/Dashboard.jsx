import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { useProfile } from '../hooks/useProfile'
import { TOTAL_CARDS } from '../constants'
import { celebrateAlbumComplete } from '../lib/celebrateAlbum'
import { getJugador, SPECIAL_START, SPECIAL_TOTAL } from '../data/jugadores'
import FAQ from '../components/FAQ'

const COMMON_THRESHOLD = 600

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
  const [notasCount, setNotasCount] = useState(0)
  const prevUniqueRef = useRef(null)
  const celebrated100Ref = useRef(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [cardsRes, notasRes] = await Promise.all([
        supabase.from('user_cards').select('card_number, quantity').eq('user_id', user.id),
        supabase.from('notas').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ])
      if (!cancelled) {
        if (!cardsRes.error && cardsRes.data) setRows(cardsRes.data)
        if (!notasRes.error) setNotasCount(notasRes.count ?? 0)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user.id])

  const stats = useMemo(() => {
    const unique = rows.length
    const totalCopies = rows.reduce((s, r) => s + (r.quantity || 0), 0)
    const duplicateExtra = rows.reduce((s, r) => s + Math.max(0, (r.quantity || 1) - 1), 0)
    const pct = Math.round((unique / TOTAL_CARDS) * 1000) / 10
    const missing = TOTAL_CARDS - unique
    const especiales = rows.filter((r) => r.card_number >= SPECIAL_START).length
    return { unique, totalCopies, duplicateExtra, pct, missing, especiales }
  }, [rows])

  const proStats = useMemo(() => {
    if (!isPro || loading) return null
    const ownedSet = new Set(rows.map((r) => r.card_number))

    let hardestMissing = null
    for (let n = TOTAL_CARDS; n >= 1; n--) {
      if (!ownedSet.has(n)) { hardestMissing = n; break }
    }

    const commonOwned = rows.filter((r) => r.card_number <= COMMON_THRESHOLD).length
    const rareOwned = rows.filter((r) => r.card_number > COMMON_THRESHOLD).length
    const commonTotal = COMMON_THRESHOLD
    const rareTotal = TOTAL_CARDS - COMMON_THRESHOLD
    const commonPct = Math.round((commonOwned / commonTotal) * 100)
    const rarePct = Math.round((rareOwned / rareTotal) * 100)

    const missing = TOTAL_CARDS - rows.length
    let estimatedPacks = 0
    if (missing > 0) {
      const pctMissing = missing / TOTAL_CARDS
      estimatedPacks = Math.ceil(missing / Math.max(5 * pctMissing, 0.25))
    }

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

    const streak = getOrUpdateStreak()
    return { hardestMissing, commonOwned, rareOwned, commonTotal, rareTotal, commonPct, rarePct, estimatedPacks, countries, streak }
  }, [rows, isPro, loading])

  useEffect(() => {
    if (loading) return
    const u = stats.unique
    const prev = prevUniqueRef.current
    prevUniqueRef.current = u
    if (u < TOTAL_CARDS) { celebrated100Ref.current = false; return }
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
      <Helmet>
        <title>Mi álbum – SoccerSticker | Colección de cromos de fútbol 2026</title>
        <meta name="description" content="Lleva el control de tu álbum de stickers de fútbol 2026. Ve tus estadísticas, gestiona repetidos e intercambia cartas con coleccionistas cercanos." />
        <meta property="og:title" content="Mi álbum – SoccerSticker" />
        <meta property="og:description" content="Controla tu colección de cromos de fútbol 2026 con estadísticas detalladas." />
        <meta property="og:url" content="https://soccersticker.app/" />
      </Helmet>

      <header className="page-header">
        <h1>{t('dashboard_title')}</h1>
        <p>{t('dashboard_subtitle')}</p>
      </header>

      {/* ── Quick Stats Grid ── */}
      <section className="qstats-grid" aria-label="Estadísticas del álbum">
        {/* Completado — wide card */}
        <Link to="/coleccion" className="qstat-card qstat-card--pct qstat-card--wide">
          <span className="qstat-card__icon">📊</span>
          <strong className="qstat-card__value">
            {stats.pct}<small>%</small>
          </strong>
          <span className="qstat-card__label">{t('qstat_completado')}</span>
          <div className="qstat-bar">
            <div
              className="qstat-bar__fill"
              style={{ width: `${Math.min(100, stats.pct)}%` }}
            />
          </div>
          <span className="qstat-card__sub">
            {t('qstat_de_total', { n: stats.unique, total: TOTAL_CARDS })}
          </span>
        </Link>

        {/* Tengo */}
        <Link to="/coleccion?vista=tengo" className="qstat-card qstat-card--tengo">
          <span className="qstat-card__icon">✅</span>
          <strong className="qstat-card__value">{stats.unique}</strong>
          <span className="qstat-card__label">{t('qstat_tengo')}</span>
        </Link>

        {/* Me faltan */}
        <Link to="/coleccion?vista=faltan" className="qstat-card qstat-card--faltan">
          <span className="qstat-card__icon">❌</span>
          <strong className="qstat-card__value">{stats.missing}</strong>
          <span className="qstat-card__label">{t('qstat_faltan')}</span>
        </Link>

        {/* Repetidas */}
        <Link to="/duplicados" className="qstat-card qstat-card--dupes">
          <span className="qstat-card__icon">🔄</span>
          <strong className="qstat-card__value">{stats.duplicateExtra}</strong>
          <span className="qstat-card__label">{t('qstat_repetidas')}</span>
        </Link>

        {/* Especiales — Pro gated */}
        {isPro ? (
          <Link to="/coleccion?vista=especiales" className="qstat-card qstat-card--shine">
            <span className="qstat-card__icon">⭐</span>
            <strong className="qstat-card__value">
              {stats.especiales}<small>/{SPECIAL_TOTAL}</small>
            </strong>
            <span className="qstat-card__label">{t('qstat_especiales')}</span>
          </Link>
        ) : (
          <Link to="/premium" className="qstat-card qstat-card--shine qstat-card--locked">
            <span className="qstat-card__icon">⭐</span>
            <strong className="qstat-card__value qstat-card__value--blur">??</strong>
            <span className="qstat-card__label">{t('qstat_especiales')}</span>
            <span className="qstat-card__lock-badge">🔒 Pro</span>
          </Link>
        )}

        {/* Mis Notas */}
        <Link to="/notas" className="qstat-card qstat-card--notas">
          <span className="qstat-card__icon">📝</span>
          <strong className="qstat-card__value">{notasCount}</strong>
          <span className="qstat-card__label">{t('qstat_notas')}</span>
        </Link>
      </section>

      {/* ── Mark Cards CTA ── */}
      <Link to="/coleccion" className="mark-cta">
        <span aria-hidden="true">➕</span>
        {t('btn_marcar')}
      </Link>

      {/* ── Pro Dashboard ── */}
      {isPro && proStats ? (
        <section className="pro-dashboard">
          <h2 className="pro-dashboard__title">
            <span className="pro-badge">{t('pro_badge')}</span>{' '}
            {t('pro_dashboard_title')}
          </h2>
          <div className="pro-dashboard__grid">
            <article className="pro-stat-card">
              <span className="pro-stat-card__label">{t('pro_hardest_title')}</span>
              {proStats.hardestMissing ? (
                <strong className="pro-stat-card__value">
                  #{proStats.hardestMissing}
                  <small className="pro-stat-card__sub">
                    {' '}{getJugador(proStats.hardestMissing).nombre}
                  </small>
                </strong>
              ) : (
                <strong className="pro-stat-card__value pro-stat-card__value--complete">
                  {t('pro_hardest_none')}
                </strong>
              )}
            </article>

            <article className="pro-stat-card">
              <span className="pro-stat-card__label">{t('pro_packs_title')}</span>
              <strong className="pro-stat-card__value">
                {proStats.estimatedPacks === 0
                  ? t('pro_packs_complete')
                  : t('pro_packs_value', { n: proStats.estimatedPacks })}
              </strong>
            </article>

            <article className="pro-stat-card">
              <span className="pro-stat-card__label">{t('pro_streak_title')}</span>
              <strong className="pro-stat-card__value">
                🔥{' '}
                {proStats.streak === 1
                  ? t('pro_streak_days', { n: proStats.streak })
                  : t('pro_streak_days_plural', { n: proStats.streak })}
              </strong>
            </article>

            <article className="pro-stat-card pro-stat-card--wide">
              <span className="pro-stat-card__label">{t('pro_rarity_title')}</span>
              <div className="pro-rarity">
                <div className="pro-rarity__row">
                  <span>{t('pro_rarity_common', { pct: proStats.commonPct })}</span>
                  <span>{proStats.commonOwned}/{proStats.commonTotal}</span>
                </div>
                <div className="pro-rarity__bar">
                  <div className="pro-rarity__fill pro-rarity__fill--common" style={{ width: `${proStats.commonPct}%` }} />
                </div>
                <div className="pro-rarity__row">
                  <span>{t('pro_rarity_rare', { pct: proStats.rarePct })}</span>
                  <span>{proStats.rareOwned}/{proStats.rareTotal}</span>
                </div>
                <div className="pro-rarity__bar">
                  <div className="pro-rarity__fill pro-rarity__fill--rare" style={{ width: `${proStats.rarePct}%` }} />
                </div>
              </div>
            </article>
          </div>

          <div className="pro-countries">
            <h3 className="pro-countries__title">{t('pro_countries_title')}</h3>
            <div className="pro-countries__list">
              {proStats.countries.map(({ pais, owned, total, pct }) => (
                <div key={pais} className="pro-country-row">
                  <span className="pro-country-row__name">{pais}</span>
                  <div className="pro-country-row__bar-wrap">
                    <div className="pro-country-row__bar" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="pro-country-row__pct">{pct}%</span>
                  <span className="pro-country-row__count">{owned}/{total}</span>
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

      <section className="how-section">
        <h2 className="how-section__title">{t('how_title')}</h2>
        <div className="how-steps">
          <div className="how-step">
            <span className="how-step__emoji">📋</span>
            <div>
              <strong className="how-step__label">{t('how_1_label')}</strong>
              <p className="how-step__desc">{t('how_1_desc')}</p>
            </div>
          </div>
          <div className="how-step">
            <span className="how-step__emoji">🔄</span>
            <div>
              <strong className="how-step__label">{t('how_2_label')}</strong>
              <p className="how-step__desc">{t('how_2_desc')}</p>
            </div>
          </div>
          <div className="how-step">
            <span className="how-step__emoji">💬</span>
            <div>
              <strong className="how-step__label">{t('how_3_label')}</strong>
              <p className="how-step__desc">{t('how_3_desc')}</p>
            </div>
          </div>
        </div>
      </section>

      <FAQ />
    </div>
  )
}
