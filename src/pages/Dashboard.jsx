import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { useProfile } from '../hooks/useProfile'
import { TOTAL_CARDS } from '../constants'
import { celebrateAlbumComplete } from '../lib/celebrateAlbum'
import { getCarta, EQUIPOS, SPECIAL_TOTAL, isEspecial } from '../data/jugadores'
import FAQ from '../components/FAQ'

const CARTAS_POR_EQUIPO = 20

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
        supabase.from('user_cards').select('carta_id, cantidad').eq('user_id', user.id),
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
    const totalCopies = rows.reduce((s, r) => s + (r.cantidad || 0), 0)
    const duplicateExtra = rows.reduce((s, r) => s + Math.max(0, (r.cantidad || 1) - 1), 0)
    const pct = Math.round((unique / TOTAL_CARDS) * 1000) / 10
    const missing = TOTAL_CARDS - unique
    const especiales = rows.filter((r) => isEspecial(r.carta_id)).length
    return { unique, totalCopies, duplicateExtra, pct, missing, especiales }
  }, [rows])

  const proStats = useMemo(() => {
    if (!isPro || loading) return null
    const ownedSet = new Set(rows.map((r) => r.carta_id))

    // Find hardest missing: last team's last card that isn't owned
    let hardestMissing = null
    outer: for (let ei = EQUIPOS.length - 1; ei >= 0; ei--) {
      const eq = EQUIPOS[ei]
      for (let ci = eq.cartas.length - 1; ci >= 0; ci--) {
        const id = `${eq.id}_${eq.cartas[ci].numero}`
        if (!ownedSet.has(id)) { hardestMissing = id; break outer }
      }
    }

    const missing = TOTAL_CARDS - rows.length
    let estimatedPacks = 0
    if (missing > 0) {
      const pctMissing = missing / TOTAL_CARDS
      estimatedPacks = Math.ceil(missing / Math.max(7 * pctMissing, 0.14))
    }

    const countries = EQUIPOS.map((eq) => {
      const total = eq.cartas.length
      const owned = eq.cartas.filter((c) => ownedSet.has(`${eq.id}_${c.numero}`)).length
      const pct = Math.round((owned / total) * 100)
      return { pais: `${eq.bandera} ${eq.nombre}`, owned, total, pct }
    }).sort((a, b) => a.pct - b.pct).slice(0, 8)

    const streak = getOrUpdateStreak()
    return { hardestMissing, estimatedPacks, countries, streak }
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
                  <small className="pro-stat-card__sub">
                    {getCarta(proStats.hardestMissing).equipo.bandera}{' '}
                    {getCarta(proStats.hardestMissing).carta.nombre}
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
              <span className="pro-stat-card__label">{t('pro_countries_title')}</span>
              <div className="pro-rarity">
                {proStats.countries.slice(0, 4).map(({ pais, owned, total, pct }) => (
                  <div key={pais}>
                    <div className="pro-rarity__row">
                      <span>{pais}</span>
                      <span>{owned}/{total}</span>
                    </div>
                    <div className="pro-rarity__bar">
                      <div className="pro-rarity__fill pro-rarity__fill--common" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
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
