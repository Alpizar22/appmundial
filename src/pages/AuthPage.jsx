import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'

function safeReturnPath(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return '/'
  if (raw.startsWith('/auth')) return '/'
  return /^\/($|coleccion|duplicados|intercambios|chat(\/.*)?)$/.test(raw) ? raw : '/'
}

export default function AuthPage() {
  const { user, loading } = useAuth()
  const { t } = useLang()
  const location = useLocation()
  const from = safeReturnPath(location.state?.from?.pathname) || '/'

  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  if (loading) {
    return (
      <div className="screen-loading" aria-busy="true">
        <div className="screen-loading__spinner" />
      </div>
    )
  }

  if (user) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (err) throw err
      } else {
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })
        if (err) throw err
        setMessage(t('auth_msg_confirm'))
      }
    } catch (err) {
      setError(err.message || t('auth_err_fallback'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <Helmet>
        <title>Iniciar sesión – SoccerSticker | Álbum de cromos de fútbol</title>
        <meta name="description" content="Accede a tu colección de cromos de fútbol 2026. Organiza tus estampitas, gestiona repetidos e intercambia con coleccionistas. Regístrate gratis." />
        <meta property="og:title" content="Inicia sesión – SoccerSticker" />
        <meta property="og:description" content="Organiza tu álbum de cromos de fútbol digital. Gratis para siempre." />
        <meta property="og:url" content="https://soccersticker.app/auth" />
      </Helmet>
      <div className="auth-card">
        <div className="auth-card__hero">
          <span className="auth-card__ball" aria-hidden="true">
            ⚽
          </span>
          <h1>{t('auth_title')}</h1>
          <p>{t('auth_subtitle')}</p>
        </div>
        <div className="auth-card__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'auth-tab auth-tab--active' : 'auth-tab'}
            onClick={() => {
              setMode('login')
              setError('')
              setMessage('')
            }}
          >
            {t('auth_tab_login')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'auth-tab auth-tab--active' : 'auth-tab'}
            onClick={() => {
              setMode('register')
              setError('')
              setMessage('')
            }}
          >
            {t('auth_tab_register')}
          </button>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>{t('auth_label_email')}</span>
            <input
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={t('auth_placeholder_email')}
            />
          </label>
          <label className="field">
            <span>{t('auth_label_password')}</span>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder={t('auth_placeholder_password')}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          {message && <p className="form-success">{message}</p>}
          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy
              ? t('auth_btn_processing')
              : mode === 'login'
                ? t('auth_btn_login')
                : t('auth_btn_register')}
          </button>
        </form>
      </div>
    </div>
  )
}
