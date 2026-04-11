import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { IconChat, IconGrid, IconHome, IconLayers, IconSwap } from './NavIcons'

const nav = [
  { to: '/', label: 'Inicio', end: true, Icon: IconHome },
  { to: '/coleccion', label: 'Colección', Icon: IconGrid },
  { to: '/duplicados', label: 'Duplicados', Icon: IconLayers },
  { to: '/intercambios', label: 'Intercambios', Icon: IconSwap },
  { to: '/chat', label: 'Chat', prefix: true, Icon: IconChat },
]

export default function Layout() {
  const { signOut, user } = useAuth()
  const location = useLocation()

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__logo" aria-hidden="true">
            ⚽
          </span>
          <div>
            <strong>Mundial 2026</strong>
            <span className="app-header__subtitle">Álbum de cartas</span>
          </div>
        </div>
        <nav className="app-nav" aria-label="Principal">
          {nav.map(({ to, label, end, prefix, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => {
                const active = prefix ? location.pathname.startsWith(to) : isActive
                return active ? 'app-nav__link app-nav__link--active' : 'app-nav__link'
              }}
            >
              <span className="app-nav__inner">
                <Icon className="app-nav__icon" />
                <span className="app-nav__label">{label}</span>
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="app-header__user">
          <span className="app-header__email" title={user?.email}>
            {user?.email}
          </span>
          <button type="button" className="btn btn--ghost" onClick={() => signOut()}>
            Salir
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
