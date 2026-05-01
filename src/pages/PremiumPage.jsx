import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { loadStripe } from '@stripe/stripe-js'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { useProfile } from '../hooks/useProfile'
import { THEMES, useTheme } from '../hooks/useTheme'

// Preload Stripe.js early for fraud-signal capture
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY ?? '')

const FEATURES = [
  { emoji: '🎨', key: 'themes',    tag: '12' },
  { emoji: '👤', key: 'avatar',    tag: '24' },
  { emoji: '🏆', key: 'titulo',    tag: null },
  { emoji: '🔄', key: 'trades',    tag: null },
  { emoji: '💬', key: 'chat',      tag: null },
  { emoji: '📊', key: 'dashboard', tag: null },
  { emoji: '🎲', key: 'odds',      tag: null },
  { emoji: '⭐', key: 'badge',     tag: null },
  { emoji: '🚀', key: 'priority',  tag: null },
]

// Avatars shown in the preview strip
const AVATAR_PREVIEW = ['🐐', '🦅', '🦁', '⚽', '🏆', '🔥', '👑', '⚡']

// Titles shown in the preview strip
const TITULO_PREVIEW = ['El Goat', 'Pichichi', 'Leyenda', 'Mito', 'Crack', 'Capitán']

export default function PremiumPage() {
  const { user } = useAuth()
  const { t, locale } = useLang()
  const { isPro, loading: profileLoading, profile } = useProfile()
  const [searchParams] = useSearchParams()
  const justPaid = searchParams.get('success') === 'true'

  const { theme, setTheme } = useTheme({ isPro, userId: user?.id, savedTheme: profile?.tema })

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [confirmed, setConfirmed] = useState(false)
  useEffect(() => {
    if (!justPaid || confirmed) return
    setConfirmed(true)
  }, [justPaid, confirmed])

  async function handleCheckout() {
    setError('')
    setBusy(true)
    try {
      await stripePromise

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || res.statusText)

      window.location.href = json.url
    } catch (err) {
      setError(err.message === 'already_pro' ? '' : t('premium_err_fallback'))
      setBusy(false)
    }
  }

  if (profileLoading) {
    return (
      <div className="screen-loading">
        <div className="screen-loading__spinner" />
      </div>
    )
  }

  const proDate = profile?.pro_since
    ? new Date(profile.pro_since).toLocaleDateString(locale)
    : null

  return (
    <div className="page premium">
      <Helmet>
        <title>SoccerSticker Pro – Potencia tu colección de cromos de fútbol</title>
        <meta name="description" content="Desbloquea funciones premium: estadísticas avanzadas del álbum, 12 temas exclusivos, 24 avatares, badge Pro y chat con coleccionistas. Solo $2.99 pago único." />
        <meta property="og:title" content="SoccerSticker Pro – $2.99 pago único" />
        <meta property="og:description" content="Estadísticas avanzadas, temas, avatares y más para tu colección de cromos de fútbol. Pago único sin suscripción." />
        <meta property="og:url" content="https://soccersticker.app/premium" />
      </Helmet>

      {/* —— Success banner —— */}
      {justPaid && isPro && (
        <div className="premium-success-banner">
          <span className="premium-success-banner__icon">🎉</span>
          <div>
            <strong>{t('premium_success_title')}</strong>
            <p>{t('premium_success_body')}</p>
          </div>
        </div>
      )}

      {/* —— Hero —— */}
      <header className="premium-hero">
        <div className="premium-hero__badge">PRO</div>
        <h1 className="premium-hero__title">{t('premium_title')}</h1>
        <p className="premium-hero__subtitle">{t('premium_subtitle')}</p>
        {!isPro && (
          <div className="premium-hero__price-wrap">
            <span className="premium-hero__price">$2.99</span>
            <span className="premium-hero__price-note">{t('premium_one_time')}</span>
          </div>
        )}
      </header>

      {/* —— CTA (top, non-Pro only) —— */}
      {!isPro && (
        <div className="premium-cta premium-cta--top">
          {error && <p className="form-error">{error}</p>}
          <button
            type="button"
            className="btn btn--primary btn--block premium-cta__btn"
            onClick={handleCheckout}
            disabled={busy}
          >
            {busy ? t('premium_btn_busy') : t('premium_btn_buy')}
          </button>
          <div className="premium-cta__trust">
            <span>🔒 {t('premium_secure')}</span>
            <span>💳 {t('premium_one_time')}</span>
          </div>
        </div>
      )}

      {/* —— Features grid —— */}
      <section className="premium-features">
        <p className="premium-section-label">{t('premium_features_title')}</p>
        <div className="premium-feature-grid">
          {FEATURES.map(({ emoji, key, tag }) => (
            <article
              key={key}
              className={`premium-fcard${isPro ? ' premium-fcard--active' : ''}`}
            >
              {isPro && <span className="premium-fcard__check">✓</span>}
              <span className="premium-fcard__emoji">{emoji}</span>
              <strong className="premium-fcard__name">{t(`premium_feature_${key}`)}</strong>
              <p className="premium-fcard__desc">{t(`premium_feature_${key}_desc`)}</p>
              {tag && <span className="premium-fcard__tag">{tag}</span>}
            </article>
          ))}
        </div>
      </section>

      {/* —— Preview strips —— */}
      <section className="premium-previews">
        {/* Avatar preview */}
        <div className="premium-preview-block">
          <p className="premium-preview-block__label">👤 {t('premium_feature_avatar')}</p>
          <div className="premium-avatar-strip">
            {AVATAR_PREVIEW.map((em) => (
              <span key={em} className="premium-avatar-item">{em}</span>
            ))}
            <span className="premium-avatar-item premium-avatar-item--more">+16</span>
          </div>
        </div>

        {/* Title preview */}
        <div className="premium-preview-block">
          <p className="premium-preview-block__label">🏆 {t('premium_feature_titulo')}</p>
          <div className="premium-titulo-strip">
            {TITULO_PREVIEW.map((tit) => (
              <span key={tit} className="premium-titulo-chip">{tit}</span>
            ))}
          </div>
        </div>
      </section>

      {/* —— Theme picker —— */}
      <section className="theme-picker">
        <h2 className="theme-picker__title">{t('theme_picker_title')}</h2>
        <p className="theme-picker__desc">{t('theme_picker_desc')}</p>
        <div className="theme-picker__grid">
          {Object.entries(THEMES).map(([key, info]) => {
            const active = theme === key
            const locked = !isPro && key !== 'default'
            return (
              <button
                key={key}
                type="button"
                className={`theme-swatch${active ? ' theme-swatch--active' : ''}${locked ? ' theme-swatch--locked' : ''}`}
                onClick={() => isPro && setTheme(key)}
                disabled={locked}
                title={locked ? t('theme_locked') : info.label}
              >
                <span className="theme-swatch__emoji">{info.emoji}</span>
                <span className="theme-swatch__label">{t(`theme_${key}`)}</span>
                {active && <span className="theme-swatch__check">✓</span>}
                {locked && <span className="theme-swatch__lock">🔒</span>}
              </button>
            )
          })}
        </div>
      </section>

      {/* —— CTA / Pro status —— */}
      {isPro ? (
        <div className="premium-pro-status">
          <div className="premium-pro-status__crown">👑</div>
          <strong>{t('premium_already_pro')}</strong>
          {proDate && (
            <p className="premium-pro-status__since">
              {t('premium_pro_since', { date: proDate })}
            </p>
          )}
          <p className="premium-pro-status__label">{t('premium_active_benefits')}</p>
          <Link to="/perfil" className="btn btn--primary btn--sm premium-pro-status__profile-btn">
            {t('profile_go_btn')}
          </Link>
        </div>
      ) : (
        <div className="premium-cta">
          {error && <p className="form-error">{error}</p>}
          <button
            type="button"
            className="btn btn--primary btn--block premium-cta__btn"
            onClick={handleCheckout}
            disabled={busy}
          >
            {busy ? t('premium_btn_busy') : t('premium_btn_buy')}
          </button>
          <div className="premium-cta__trust">
            <span>🔒 {t('premium_secure')}</span>
            <span>💳 {t('premium_one_time')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
