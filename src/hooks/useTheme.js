import { useCallback, useEffect, useState } from 'react'

export const THEMES = {
  default: {
    label: 'Default',
    emoji: '🔵',
    vars: {
      '--wc-red': '#c41e3a',
      '--wc-red-dark': '#8b1428',
      '--wc-blue': '#0a3161',
      '--wc-blue-light': '#1e4d8c',
      '--wc-navy': '#061428',
    },
  },
  gold: {
    label: 'Dorado',
    emoji: '🟡',
    vars: {
      '--wc-red': '#c9a227',
      '--wc-red-dark': '#a07c1a',
      '--wc-blue': '#252525',
      '--wc-blue-light': '#383838',
      '--wc-navy': '#111111',
    },
  },
  green: {
    label: 'Verde',
    emoji: '🟢',
    vars: {
      '--wc-red': '#1e7a48',
      '--wc-red-dark': '#145c34',
      '--wc-blue': '#0f3d22',
      '--wc-blue-light': '#1a5e35',
      '--wc-navy': '#071a0f',
    },
  },
  galaxy: {
    label: 'Galaxia',
    emoji: '🟣',
    vars: {
      '--wc-red': '#8b5cf6',
      '--wc-red-dark': '#6d28d9',
      '--wc-blue': '#1e1b4b',
      '--wc-blue-light': '#312e81',
      '--wc-navy': '#0f0c29',
    },
  },
}

const STORAGE_KEY = 'ss_theme'

function applyThemeVars(themeKey) {
  const theme = THEMES[themeKey] ?? THEMES.default
  const root = document.documentElement
  for (const [prop, val] of Object.entries(theme.vars)) {
    root.style.setProperty(prop, val)
  }
}

export function useTheme(isPro) {
  const [theme, setThemeState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return THEMES[stored] ? stored : 'default'
  })

  useEffect(() => {
    applyThemeVars(isPro ? theme : 'default')
  }, [theme, isPro])

  const setTheme = useCallback((newTheme) => {
    if (!THEMES[newTheme]) return
    localStorage.setItem(STORAGE_KEY, newTheme)
    setThemeState(newTheme)
  }, [])

  return { theme: isPro ? theme : 'default', setTheme, themes: THEMES }
}
