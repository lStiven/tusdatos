import type { Event, Session } from '@/features/events/rules'

// Mirrors of the API rules, to disable what would fail and say why beforehand.

/** Only drafts and published events can be edited or cancelled. */
export function isEditable(event: Pick<Event, 'status'>) {
  return event.status === 'DRAFT' || event.status === 'PUBLISHED'
}

export function publishBlock(
  event: Pick<Event, 'venue_id' | 'starts_at'>,
  now = Date.now(),
): 'noVenue' | 'started' | null {
  if (event.venue_id === null) return 'noVenue'
  return now >= Date.parse(event.starts_at) ? 'started' : null
}

export function completeBlock(
  event: Pick<Event, 'ends_at'>,
  now = Date.now(),
): 'notEnded' | null {
  return now < Date.parse(event.ends_at) ? 'notEnded' : null
}

/** Why a draft session cannot be scheduled yet, as far as the client can tell. */
export function scheduleBlock(
  session: Pick<Session, 'room' | 'capacity'>,
): 'needsRoom' | 'roomTooSmall' | null {
  if (session.room === null) return 'needsRoom'
  return session.capacity > session.room.capacity ? 'roomTooSmall' : null
}
