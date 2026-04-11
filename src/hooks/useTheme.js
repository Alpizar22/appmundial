import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

export const THEMES = {
  // ── Base themes ─────────────────────────────────────────────────
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
  // ── Flag themes ──────────────────────────────────────────────────
  mexico: {
    label: 'México',
    emoji: '🇲🇽',
    vars: {
      '--wc-red': '#CE1126',
      '--wc-red-dark': '#9c0d1e',
      '--wc-blue': '#006847',
      '--wc-blue-light': '#009163',
      '--wc-navy': '#003822',
    },
  },
  brasil: {
    label: 'Brasil',
    emoji: '🇧🇷',
    vars: {
      '--wc-red': '#F7D116',
      '--wc-red-dark': '#c4a510',
      '--wc-blue': '#009C3B',
      '--wc-blue-light': '#00c44b',
      '--wc-navy': '#00331a',
    },
  },
  argentina: {
    label: 'Argentina',
    emoji: '🇦🇷',
    vars: {
      '--wc-red': '#74ACDF',
      '--wc-red-dark': '#5585b5',
      '--wc-blue': '#2d6fa8',
      '--wc-blue-light': '#4a8cc9',
      '--wc-navy': '#0a1f35',
    },
  },
  alemania: {
    label: 'Alemania',
    emoji: '🇩🇪',
    vars: {
      '--wc-red': '#DD0000',
      '--wc-red-dark': '#aa0000',
      '--wc-blue': '#2a2a2a',
      '--wc-blue-light': '#404040',
      '--wc-navy': '#111111',
    },
  },
  francia: {
    label: 'Francia',
    emoji: '🇫🇷',
    vars: {
      '--wc-red': '#ED2939',
      '--wc-red-dark': '#c01e2c',
      '--wc-blue': '#002395',
      '--wc-blue-light': '#0033c9',
      '--wc-navy': '#00114a',
    },
  },
  espana: {
    label: 'España',
    emoji: '🇪🇸',
    vars: {
      '--wc-red': '#AA151B',
      '--wc-red-dark': '#800f14',
      '--wc-blue': '#5c3a00',
      '--wc-blue-light': '#8a5700',
      '--wc-navy': '#1f1200',
    },
  },
  usa: {
    label: 'USA',
    emoji: '🇺🇸',
    vars: {
      '--wc-red': '#BF0A30',
      '--wc-red-dark': '#8f0824',
      '--wc-blue': '#002868',
      '--wc-blue-light': '#003d9e',
      '--wc-navy': '#000d22',
    },
  },
  rainbow: {
    label: 'Arcoíris',
    emoji: '🌈',
    vars: {
      '--wc-red': '#f72585',
      '--wc-red-dark': '#c0166a',
      '--wc-blue': '#7209b7',
      '--wc-blue-light': '#9b2ddb',
      '--wc-navy': '#10002b',
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

export function useTheme({ isPro = false, userId = null, savedTheme = null } = {}) {
  const hasLocalChange = useRef(false)
  const [theme, setThemeState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return THEMES[stored] ? stored : 'default'
  })

  // Sync from Supabase savedTheme on first load (before any local change this session)
  useEffect(() => {
    if (savedTheme && THEMES[savedTheme] && !hasLocalChange.current) {
      localStorage.setItem(STORAGE_KEY, savedTheme)
      setThemeState(savedTheme)
    }
  }, [savedTheme])

  useEffect(() => {
    applyThemeVars(isPro ? theme : 'default')
  }, [theme, isPro])

  const setTheme = useCallback(
    (newTheme) => {
      if (!THEMES[newTheme]) return
      hasLocalChange.current = true
      localStorage.setItem(STORAGE_KEY, newTheme)
      setThemeState(newTheme)
      if (userId && isPro) {
        supabase.from('profiles').update({ tema: newTheme }).eq('id', userId).then(() => {})
      }
    },
    [userId, isPro]
  )

  return { theme: isPro ? theme : 'default', setTheme, themes: THEMES }
}
