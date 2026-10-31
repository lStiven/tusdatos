import { useSyncExternalStore } from 'react'

export interface InspectedRequest {
  id: string
  method: string
  path: string
  startedAt: number
  durationMs: number | null
  status: number | null
  code: string | null
  requestBody: string | null
  responseBody: string | null
}

const MAX_ENTRIES = 50
const SECRET_KEYS = /password|token/i
const REDACTED = '••••••'

let entries: InspectedRequest[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** Hides secrets in JSON or form bodies; other content is kept as is. */
export function redact(body: string): string {
  try {
    const json: unknown = JSON.parse(body)
    return JSON.stringify(
      json,
      (key, value: unknown) => (SECRET_KEYS.test(key) ? REDACTED : value),
      2,
    )
  } catch {
    if (!body.includes('=')) return body
    const form = new URLSearchParams(body)
    for (const key of form.keys()) {
      if (SECRET_KEYS.test(key)) form.set(key, REDACTED)
    }
    return decodeURIComponent(form.toString())
  }
}

export function recordRequest(entry: InspectedRequest) {
  entries = [entry, ...entries].slice(0, MAX_ENTRIES)
  emit()
}

export function completeRequest(
  id: string,
  update: Pick<InspectedRequest, 'status' | 'code' | 'responseBody'>,
) {
  entries = entries.map((entry) =>
    entry.id === id
      ? { ...entry, ...update, durationMs: Date.now() - entry.startedAt }
      : entry,
  )
  emit()
}

export function clearRequests() {
  entries = []
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useInspectedRequests() {
  return useSyncExternalStore(subscribe, () => entries)
}
