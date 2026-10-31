import { useSyncExternalStore } from 'react'

// sessionStorage is per tab: each tab can hold a different account (one per role).
const STORAGE_KEY = 'mis-eventos.session'

export type EndReason = 'logout' | 'expired'

interface Session {
  token: string
  expiresAt: number
}

let current: Session | null = read()
let lastEndReason: EndReason | null = null
const listeners = new Set<() => void>()

function read(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as Session
    return session.expiresAt > Date.now() ? session : null
  } catch {
    return null
  }
}

function emit() {
  for (const listener of listeners) listener()
}

export function getToken(): string | null {
  if (current && current.expiresAt <= Date.now()) endSession('expired')
  return current?.token ?? null
}

export function startSession(token: string, expiresInSeconds: number) {
  current = { token, expiresAt: Date.now() + expiresInSeconds * 1000 }
  lastEndReason = null
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  emit()
}

export function endSession(reason: EndReason) {
  if (!current) return
  current = null
  lastEndReason = reason
  sessionStorage.removeItem(STORAGE_KEY)
  emit()
}

/** Why the last session ended; read once by the login page to explain it. */
export function takeEndReason(): EndReason | null {
  const reason = lastEndReason
  lastEndReason = null
  return reason
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useToken() {
  return useSyncExternalStore(subscribe, () => current?.token ?? null)
}
