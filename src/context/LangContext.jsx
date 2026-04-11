import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import es from '../i18n/es'
import en from '../i18n/en'

const translations = { es, en }
const STORAGE_KEY = 'wc2026_lang'

function detectLang() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'es') return stored
  const nav = (navigator.language || '').toLowerCase()
  return nav.startsWith('en') ? 'en' : 'es'
}

const LangContext = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(detectLang)

  const setLang = useCallback((newLang) => {
    localStorage.setItem(STORAGE_KEY, newLang)
    setLangState(newLang)
  }, [])

  const t = useCallback(
    (key, params = {}) => {
      const dict = translations[lang] ?? translations.es
      const str = dict[key] ?? translations.es[key] ?? key
      return Object.entries(params).reduce(
        (s, [k, v]) => s.replace(`{${k}}`, String(v)),
        str
      )
    },
    [lang]
  )

  // BCP 47 locale tag for toLocaleString / toLocaleTimeString
  const locale = lang === 'en' ? 'en' : 'es'

  const value = useMemo(
    () => ({ lang, setLang, t, locale }),
    [lang, setLang, t, locale]
  )

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside LangProvider')
  return ctx
}
