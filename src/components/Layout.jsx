import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { useProfile } from '../hooks/useProfile'
import { useTheme } from '../hooks/useTheme'
import { IconChat, IconGrid, IconHome, IconLayers, IconStar, IconSwap, IconUser } from './NavIcons'

export default function Layout() {
  const { signOut, user } = useAuth()
  const { lang, setLang, t } = useLang()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef(null)

  const { isPro, titulo, avatarEmoji, tema } = useProfile()
  useTheme({ isPro, userId: user?.id, savedTheme: tema })

  const nav = [
    { to: '/', label: t('nav_home'), end: true, Icon: IconHome },
    { to: '/coleccion', label: t('nav_collection'), Icon: IconGrid },
    { to: '/duplicados', label: t('nav_duplicates'), Icon: IconLayers },
    { to: '/intercambios', label: t('nav_trades'), Icon: IconSwap, proFeature: true },
    { to: '/chat', label: t('nav_chat'), prefix: true, Icon: IconChat, proFeature: true },
    { to: '/premium', label: t('nav_premium'), Icon: IconStar, pro: true },
    ...(isPro ? [{ to: '/perfil', label: t('nav_profile'), Icon: IconUser, profileLink: true }] : []),
  ]

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // ESC key closes drawer
  useEffect(() => {
    if (!drawerOpen) return
    function onKey(e) {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  // Body scroll lock while drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-header__brand">
          <span className="app-header__logo" aria-hidden="true">
            ⚽
          </span>
          <div>
            <strong>{t('header_brand')}</strong>
            <span className="app-header__subtitle">{t('header_subtitle')}</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="app-nav" aria-label={t('nav_aria')}>
          {nav.map(({ to, label, end, prefix, Icon, pro, proFeature }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => {
                const active = prefix ? location.pathname.startsWith(to) : isActive
                const base = active ? 'app-nav__link app-nav__link--active' : 'app-nav__link'
                return pro ? `${base} app-nav__link--pro` : base
              }}
            >
              <span className="app-nav__inner">
                <Icon className="app-nav__icon" />
                <span className="app-nav__label">
                  {label}
                  {pro && isPro && (
                    <span className="app-nav__pro-dot" aria-label="Pro activo" />
                  )}
                  {proFeature && !isPro && (
                    <span className="app-nav__lock" aria-label={t('nav_pro_feature')}>🔒</span>
                  )}
                </span>
              </span>
            </NavLink>
          ))}
        </nav>

        {/* Desktop user area */}
        <div className="app-header__user">
          {isPro ? (
            <span className="app-header__identity" title={user?.email}>
              <span className="app-header__avatar" aria-hidden="true">{avatarEmoji}</span>
              <span className="app-header__titulo">{titulo}</span>
              <span className="pro-badge">{t('pro_badge')}</span>
            </span>
          ) : (
            <span className="app-header__email" title={user?.email}>
              {user?.email}
            </span>
          )}
          <div className="lang-toggle" role="group" aria-label="Language / Idioma">
            <button
              type="button"
              className={`btn btn--ghost btn--sm${lang === 'es' ? ' lang-toggle__btn--active' : ''}`}
              onClick={() => setLang('es')}
              aria-pressed={lang === 'es'}
            >
              ES
            </button>
            <button
              type="button"
              className={`btn btn--ghost btn--sm${lang === 'en' ? ' lang-toggle__btn--active' : ''}`}
              onClick={() => setLang('en')}
              aria-pressed={lang === 'en'}
            >
              EN
            </button>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => signOut()}>
            {t('btn_logout')}
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="hamburger-btn"
          aria-label={t('nav_open_menu')}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          ☰
        </button>
      </header>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="drawer-overlay"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        ref={drawerRef}
        className={`drawer${drawerOpen ? ' drawer--open' : ''}`}
        aria-label={t('nav_aria')}
        role="dialog"
        aria-modal="true"
      >
        {/* Drawer header: user identity */}
        <div className="drawer__header">
          <div className="drawer__identity">
            {isPro ? (
              <>
                <span className="drawer__avatar" aria-hidden="true">{avatarEmoji}</span>
                <div>
                  <span className="drawer__titulo">{titulo}</span>
                  <span className="pro-badge">{t('pro_badge')}</span>
                </div>
              </>
            ) : (
              <span className="drawer__email">{user?.email}</span>
            )}
          </div>
          <button
            type="button"
            className="drawer__close"
            aria-label={t('nav_close_menu')}
            onClick={() => setDrawerOpen(false)}
          >
            ✕
          </button>
        </div>

        {/* Drawer nav links */}
        <nav className="drawer__links" aria-label={t('nav_aria')}>
          {nav.map(({ to, label, end, prefix, Icon, pro, proFeature, profileLink }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => {
                const active = prefix ? location.pathname.startsWith(to) : isActive
                let cls = `drawer__link${active ? ' drawer__link--active' : ''}`
                if (pro || profileLink) cls += ' drawer__link--pro'
                return cls
              }}
            >
              <Icon className="drawer__link-icon" />
              <span>{label}</span>
              {proFeature && !isPro && <span className="drawer__lock">🔒</span>}
              {(pro || profileLink) && isPro && <span className="pro-badge">{t('pro_badge')}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Drawer footer: lang + logout */}
        <div className="drawer__footer">
          <div className="lang-toggle" role="group" aria-label="Language / Idioma">
            <button
              type="button"
              className={`btn btn--ghost btn--sm${lang === 'es' ? ' lang-toggle__btn--active' : ''}`}
              onClick={() => setLang('es')}
              aria-pressed={lang === 'es'}
            >
              ES
            </button>
            <button
              type="button"
              className={`btn btn--ghost btn--sm${lang === 'en' ? ' lang-toggle__btn--active' : ''}`}
              onClick={() => setLang('en')}
              aria-pressed={lang === 'en'}
            >
              EN
            </button>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => signOut()}>
            {t('btn_logout')}
          </button>
        </div>
      </div>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
