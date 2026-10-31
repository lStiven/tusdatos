import type { components } from '@/api/schema'
import { es } from '@/i18n/es'

type EventRegistration = components['schemas']['EventRegistrationRead']

const r = es.lab.races

export const MIN_REQUESTS = 2
export const MAX_REQUESTS = 50

/** Keeps a typed number inside its range; anything else becomes the minimum. */
export function clamp(value: string, min: number, max: number) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return min
  return Math.min(Math.max(number, min), max)
}

export interface Outcome {
  status: number
  code: string | null
  ms: number
}

export interface RaceCheck {
  label: string
  ok: boolean
  detail: string
}

/** «201 × 5 · 409 room_not_available × 14 · 503 × 1». */
export function tally(outcomes: Outcome[]) {
  const counts = new Map<string, number>()
  for (const { status, code } of outcomes) {
    const key = code ? `${status} ${code}` : String(status)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))
}

const count = (outcomes: Outcome[], status: number) =>
  outcomes.filter((outcome) => outcome.status === status).length

/** A 503 is a valid answer under load: nothing was saved and retrying is safe. */
const unexpected = (outcomes: Outcome[], allowed: number[]) =>
  outcomes.filter((outcome) => ![...allowed, 503].includes(outcome.status))
    .length

export function lastSeatChecks(
  capacity: number,
  outcomes: Outcome[],
  registrations: EventRegistration[],
): RaceCheck[] {
  const saved = count(outcomes, 201)
  const confirmed = registrations.filter((item) => item.status === 'CONFIRMED')
  const positions = registrations
    .filter((item) => item.status === 'WAITLISTED')
    .map((item) => item.waitlist_position)
  const expectedPositions = positions.map((_, index) => index + 1)
  return [
    {
      label: r.checks.neverOversold,
      ok: confirmed.length <= capacity,
      detail: r.detail.confirmed(confirmed.length, capacity),
    },
    {
      label: r.checks.seatsFilled,
      ok: confirmed.length === Math.min(capacity, saved),
      detail: r.detail.confirmed(confirmed.length, Math.min(capacity, saved)),
    },
    {
      label: r.checks.queueContiguous,
      ok: positions.join() === expectedPositions.join(),
      detail: positions.length ? positions.join(', ') : '—',
    },
    {
      label: r.checks.onePerRequest,
      ok: registrations.length === saved,
      detail: r.detail.saved(registrations.length, saved),
    },
    {
      label: r.checks.noUnexpected,
      ok: unexpected(outcomes, [201]) === 0,
      detail: String(unexpected(outcomes, [201])),
    },
  ]
}

export function retriesChecks(
  outcomes: Outcome[],
  registrations: number,
): RaceCheck[] {
  const created = count(outcomes, 201)
  return [
    {
      label: r.checks.oneRegistration,
      ok: registrations === 1,
      detail: String(registrations),
    },
    {
      label: r.checks.oneCreated,
      ok: created === 1,
      detail: r.detail.created(created, count(outcomes, 200)),
    },
    {
      label: r.checks.noUnexpected,
      ok: unexpected(outcomes, [200, 201]) === 0,
      detail: String(unexpected(outcomes, [200, 201])),
    },
  ]
}

export function sameRoomChecks(
  outcomes: Outcome[],
  scheduled: number,
): RaceCheck[] {
  const won = count(outcomes, 200)
  const lost = outcomes.filter(
    (outcome) => outcome.code === 'room_not_available',
  ).length
  return [
    {
      label: r.checks.oneBooking,
      ok: scheduled === 1 && won === 1,
      detail: r.detail.booked(scheduled, won),
    },
    {
      label: r.checks.othersRejected,
      ok: lost + count(outcomes, 503) === outcomes.length - won,
      detail: String(lost),
    },
  ]
}
