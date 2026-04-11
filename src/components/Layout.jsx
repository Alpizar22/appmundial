import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { useProfile } from '../hooks/useProfile'
import { useTheme } from '../hooks/useTheme'
import { IconChat, IconGrid, IconHome, IconLayers, IconStar, IconSwap } from './NavIcons'

export default function Layout() {
  const { signOut, user } = useAuth()
  const { lang, setLang, t } = useLang()
  const location = useLocation()

  const { isPro } = useProfile()
  useTheme(isPro) // applies theme CSS vars globally

  const nav = [
    { to: '/', label: t('nav_home'), end: true, Icon: IconHome },
    { to: '/coleccion', label: t('nav_collection'), Icon: IconGrid },
    { to: '/duplicados', label: t('nav_duplicates'), Icon: IconLayers },
    { to: '/intercambios', label: t('nav_trades'), Icon: IconSwap },
    { to: '/chat', label: t('nav_chat'), prefix: true, Icon: IconChat },
    { to: '/premium', label: t('nav_premium'), Icon: IconStar, pro: true },
  ]

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__logo" aria-hidden="true">
            ⚽
          </span>
          <div>
            <strong>{t('header_brand')}</strong>
            <span className="app-header__subtitle">{t('header_subtitle')}</span>
          </div>
        </div>
        <nav className="app-nav" aria-label={t('nav_aria')}>
          {nav.map(({ to, label, end, prefix, Icon, pro }) => (
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
                </span>
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="app-header__user">
          <span className="app-header__email" title={user?.email}>
            {user?.email}
            {isPro && <span className="pro-badge">{t('pro_badge')}</span>}
          </span>
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
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
