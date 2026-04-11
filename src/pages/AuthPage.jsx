import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

function safeReturnPath(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return '/'
  if (raw.startsWith('/auth')) return '/'
  return /^\/($|coleccion|duplicados|intercambios|chat(\/.*)?)$/.test(raw) ? raw : '/'
}

export default function AuthPage() {
  const { user, loading } = useAuth()
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
        setMessage(
          'Revisa tu correo para confirmar la cuenta (si tienes confirmación activada en Supabase).'
        )
      }
    } catch (err) {
      setError(err.message || 'No se pudo completar la acción')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__hero">
          <span className="auth-card__ball" aria-hidden="true">
            ⚽
          </span>
          <h1>Mundial 2026</h1>
          <p>Tu colección de cartas, en un solo lugar.</p>
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
            Entrar
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
            Registro
          </button>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
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
              placeholder="tu@email.com"
            />
          </label>
          <label className="field">
            <span>Contraseña</span>
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
              placeholder="••••••••"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          {message && <p className="form-success">{message}</p>}
          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'Procesando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}
