import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { useProfile } from '../hooks/useProfile'
import { THEMES, useTheme } from '../hooks/useTheme'

// Preload Stripe.js early for fraud-signal capture
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY ?? '')

const FEATURES = [
  { icon: '🎨', key: 'themes' },
  { icon: '🏅', key: 'badges' },
  { icon: '📊', key: 'dashboard' },
  { icon: '🎲', key: 'odds' },
  { icon: '✨', key: 'priority' },
]

export default function PremiumPage() {
  const { user } = useAuth()
  const { t, locale } = useLang()
  const { isPro, loading: profileLoading, profile } = useProfile()
  const [searchParams] = useSearchParams()
  const justPaid = searchParams.get('success') === 'true'

  const { theme, setTheme } = useTheme({ isPro, userId: user?.id, savedTheme: profile?.tema })

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // If arrived from Stripe with ?success=true, re-fetch profile to confirm Pro
  const [confirmed, setConfirmed] = useState(false)
  useEffect(() => {
    if (!justPaid || confirmed) return
    setConfirmed(true)
  }, [justPaid, confirmed])

  async function handleCheckout() {
    setError('')
    setBusy(true)
    try {
      await stripePromise // ensure Stripe.js is loaded

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
      </header>

      {/* —— Features grid —— */}
      <section className="premium-features">
        {FEATURES.map(({ icon, key }) => (
          <article
            key={key}
            className={`premium-feature-card${isPro ? ' premium-feature-card--active' : ''}`}
          >
            <span className="premium-feature-card__icon">{icon}</span>
            <div>
              <strong className="premium-feature-card__name">
                {t(`premium_feature_${key}`)}
              </strong>
              <p className="premium-feature-card__desc">
                {t(`premium_feature_${key}_desc`)}
              </p>
            </div>
            {isPro && <span className="premium-feature-card__check">✓</span>}
          </article>
        ))}
      </section>

      {/* —— Theme picker —— */}
      <section className="theme-picker">
        <h2 className="theme-picker__title">{t('theme_picker_title')}</h2>
        <p className="theme-picker__desc">{t('theme_picker_desc')}</p>
        <div className="theme-picker__grid">
          {Object.entries(THEMES).map(([key, info]) => {
            const active = theme === key
            const disabled = !isPro && key !== 'default'
            return (
              <button
                key={key}
                type="button"
                className={`theme-swatch${active ? ' theme-swatch--active' : ''}${disabled ? ' theme-swatch--locked' : ''}`}
                onClick={() => isPro && setTheme(key)}
                disabled={disabled}
                title={disabled ? t('theme_locked') : info.label}
              >
                <span className="theme-swatch__emoji">{info.emoji}</span>
                <span className="theme-swatch__label">{t(`theme_${key}`)}</span>
                {active && <span className="theme-swatch__check">✓</span>}
                {disabled && <span className="theme-swatch__lock">🔒</span>}
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
