import { useEffect, useState } from 'react'
import { useLang } from '../context/LangContext'

const DISMISSED_KEY = 'pwa_install_dismissed'

export default function PWAInstallBanner() {
  const { lang } = useLang()
  const [prompt, setPrompt] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // No mostrar si ya fue descartado en esta sesión
    if (sessionStorage.getItem(DISMISSED_KEY)) return

    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setVisible(false)
    }
    setPrompt(null)
  }

  function handleDismiss() {
    sessionStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  const text =
    lang === 'en'
      ? { title: 'Install SoccerSticker', body: 'Add to your home screen for quick access.', install: 'Install', later: 'Not now' }
      : { title: 'Instalar SoccerSticker', body: 'Agregá la app a tu pantalla de inicio.', install: 'Instalar', later: 'Ahora no' }

  return (
    <div className="pwa-banner" role="dialog" aria-label={text.title}>
      <span className="pwa-banner__icon" aria-hidden="true">⚽</span>
      <div className="pwa-banner__text">
        <strong>{text.title}</strong>
        <span>{text.body}</span>
      </div>
      <div className="pwa-banner__actions">
        <button type="button" className="btn btn--primary btn--sm" onClick={handleInstall}>
          {text.install}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={handleDismiss}>
          {text.later}
        </button>
      </div>
    </div>
  )
}
