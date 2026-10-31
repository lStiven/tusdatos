import { useSyncExternalStore } from 'react'

// Light, dark or follow the system. public/theme-init.js applies the same
// rules before the app loads (same storage key and classes).
export type Theme = 'light' | 'dark' | 'system'

const KEY = 'theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function saved(): Theme {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function resolve(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme
  return media().matches ? 'dark' : 'light'
}

/** Puts the theme on <html>, without animating every colour change. */
function apply() {
  const resolved = resolve(saved())
  const root = document.documentElement
  root.classList.add('theme-switching')
  root.classList.toggle('dark', resolved === 'dark')
  root.classList.toggle('light', resolved === 'light')
  root.style.colorScheme = resolved
  requestAnimationFrame(() => root.classList.remove('theme-switching'))
}

export function setTheme(theme: Theme) {
  try {
    if (theme === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch {
    // Storage blocked: the choice lasts until the page reloads.
  }
  apply()
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // «System» follows the operating system while the app is open.
  const onSystemChange = () => {
    apply()
    listener()
  }
  media().addEventListener('change', onSystemChange)
  return () => {
    listeners.delete(listener)
    media().removeEventListener('change', onSystemChange)
  }
}

const snapshot = () => `${saved()}:${resolve(saved())}`

export function useTheme() {
  const [theme, resolved] = useSyncExternalStore(subscribe, snapshot).split(
    ':',
  ) as [Theme, 'light' | 'dark']
  return { theme, resolvedTheme: resolved, setTheme }
}

/** On start: the init script may not have run (tests, blocked storage). */
export function initTheme() {
  apply()
}
