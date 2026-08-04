import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'

export default function Layout() {
  const { user, signOut } = useAuth()
  const { lang, setLang, t } = useLang()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const nav = [
    { to: '/', label: t('nav_home'), end: true },
    { to: '/explorar', label: t('nav_explorar') },
  ]

  useEffect(() => { setDrawerOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-header__brand">
          <span className="app-header__logo" aria-hidden="true">🤔⚽</span>
          <div>
            <strong>{t('header_brand')}</strong>
            <span className="app-header__subtitle">{t('header_subtitle')}</span>
          </div>
        </Link>

        <nav className="app-nav" aria-label={t('nav_aria')}>
          {nav.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => isActive ? 'app-nav__link app-nav__link--active' : 'app-nav__link'}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="app-header__user">
          <div className="lang-toggle" role="group" aria-label="Language / Idioma">
            <button type="button" className={`btn btn--ghost btn--sm${lang === 'es' ? ' lang-toggle__btn--active' : ''}`} onClick={() => setLang('es')} aria-pressed={lang === 'es'}>ES</button>
            <button type="button" className={`btn btn--ghost btn--sm${lang === 'en' ? ' lang-toggle__btn--active' : ''}`} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>EN</button>
          </div>
          {user ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => signOut()}>{t('btn_logout')}</button>
          ) : (
            <Link to="/auth" className="btn btn--ghost btn--sm">{t('btn_login')}</Link>
          )}
        </div>

        <button type="button" className="hamburger-btn" aria-label={t('nav_open_menu')} aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>☰</button>
      </header>

      {drawerOpen && <div className="drawer-overlay" aria-hidden="true" onClick={() => setDrawerOpen(false)} />}

      <div className={`drawer${drawerOpen ? ' drawer--open' : ''}`} role="dialog" aria-modal="true" aria-label={t('nav_aria')}>
        <div className="drawer__header">
          <span className="drawer__brand">{t('header_brand')}</span>
          <button type="button" className="drawer__close" aria-label={t('nav_close_menu')} onClick={() => setDrawerOpen(false)}>✕</button>
        </div>
        <nav className="drawer__links" aria-label={t('nav_aria')}>
          {nav.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `drawer__link${isActive ? ' drawer__link--active' : ''}`}>{label}</NavLink>
          ))}
        </nav>
        <div className="drawer__footer">
          <div className="lang-toggle" role="group" aria-label="Language / Idioma">
            <button type="button" className={`btn btn--ghost btn--sm${lang === 'es' ? ' lang-toggle__btn--active' : ''}`} onClick={() => setLang('es')} aria-pressed={lang === 'es'}>ES</button>
            <button type="button" className={`btn btn--ghost btn--sm${lang === 'en' ? ' lang-toggle__btn--active' : ''}`} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>EN</button>
          </div>
          {user ? (
            <button type="button" className="btn btn--ghost" onClick={() => signOut()}>{t('btn_logout')}</button>
          ) : (
            <Link to="/auth" className="btn btn--ghost">{t('btn_login')}</Link>
          )}
        </div>
      </div>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
