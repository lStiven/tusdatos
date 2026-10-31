import type { components } from '@/api/schema'

export type Event = components['schemas']['EventRead']
export type Registration = components['schemas']['RegistrationRead']
export type Session = components['schemas']['SessionRead']

// The API decides; these mirror its rules only to disable what would fail and say why.

/** Why registering is not possible now, or `null` if it is. */
export function registrationBlock(
  event: Pick<Event, 'status' | 'starts_at' | 'registration_closes_at'>,
  now = Date.now(),
): Exclude<Event['status'], 'PUBLISHED'> | 'closed' | null {
  if (event.status !== 'PUBLISHED') return event.status
  const closesAt = event.registration_closes_at ?? event.starts_at
  return now >= Date.parse(closesAt) ? 'closed' : null
}

/** Cancelling is allowed until the event starts, even after registration closed. */
export function canCancel(
  event: Pick<Event, 'starts_at'>,
  registration: Pick<Registration, 'status'> | null,
  now = Date.now(),
): boolean {
  return (
    registration !== null &&
    registration.status !== 'CANCELLED' &&
    now < Date.parse(event.starts_at)
  )
}

/** Why the user cannot mark interest in the session, or `null` if they can. */
export function interestBlock(
  session: Pick<Session, 'status' | 'starts_at'>,
  registration: Pick<Registration, 'status'> | null,
  now = Date.now(),
): 'notOpen' | 'notConfirmed' | null {
  if (session.status !== 'SCHEDULED' || Date.parse(session.starts_at) <= now) {
    return 'notOpen'
  }
  if (registration?.status !== 'CONFIRMED') return 'notConfirmed'
  return null
}

/** Other non-cancelled sessions of interest that overlap in time with `session`. */
export function overlapping(session: Session, sessions: Session[]): Session[] {
  const start = Date.parse(session.starts_at)
  const end = Date.parse(session.ends_at)
  return sessions.filter(
    (other) =>
      other.id !== session.id &&
      other.is_interested &&
      other.status !== 'CANCELLED' &&
      Date.parse(other.starts_at) < end &&
      start < Date.parse(other.ends_at),
  )
}
