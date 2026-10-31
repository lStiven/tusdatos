import type { components } from '@/api/schema'
import { es } from '@/i18n/es'
import { bearer, describeReply, labApi, send, type Reply } from './client'

type Event = components['schemas']['EventRead']

/** Temporary accounts share this domain so they are easy to recognise. */
export const LAB_DOMAIN = 'lab.example.com'
const LAB_PASSWORD = 'lab-password-1234'
const DAY = 86_400_000
const HOUR = 3_600_000

export interface Account {
  id: number
  email: string
  token: string
}

/** A failed preparation step: the scenario cannot run, and says why. */
export class LabSetupError extends Error {}

function must<T>(reply: Reply<T>, status: number, what: string): T {
  if (reply.status !== status || reply.data === undefined) {
    throw new LabSetupError(es.lab.setupFailed(what, describeReply(reply)))
  }
  return reply.data
}

/** Unique per run, so runs never collide with each other. */
export function newStamp() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Registers and logs in each account, one after another: every password hash
 * costs ~64 MiB and ~60 ms on the server, so they are never sent in bulk.
 */
export async function createAccounts<K extends string>(
  stamp: string,
  names: readonly K[],
  onProgress?: (done: number) => void,
): Promise<Record<K, Account>> {
  const accounts = {} as Record<K, Account>
  for (const [index, name] of names.entries()) {
    const email = `lab-${stamp}-${name}@${LAB_DOMAIN}`
    const user = must(
      await send(
        labApi.POST('/api/v1/auth/register', {
          body: { email, password: LAB_PASSWORD, full_name: `Lab ${name}` },
        }),
      ),
      201,
      es.lab.setup.register(email),
    )
    const token = must(
      await send(
        labApi.POST('/api/v1/auth/token', {
          body: { username: email, password: LAB_PASSWORD, scope: '' },
          bodySerializer: (body) =>
            new URLSearchParams(body as Record<string, string>),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      ),
      200,
      es.lab.setup.login(email),
    )
    accounts[name] = { id: user.id, email, token: token.access_token }
    onProgress?.(index + 1)
  }
  return accounts
}

export async function grantOrganizer(adminToken: string, account: Account) {
  must(
    await send(
      labApi.PUT('/api/v1/users/{user_id}/roles/{role}', {
        params: { path: { user_id: account.id, role: 'ORGANIZER' } },
        headers: bearer(adminToken),
      }),
    ),
    200,
    es.lab.setup.grant(account.email),
  )
}

export interface LabRoom {
  venueId: number
  roomId: number
  capacity: number
}

/** The largest active room of an active venue: lab events and talks go there. */
export async function findRoom(token: string): Promise<LabRoom> {
  const venues = must(
    await send(
      labApi.GET('/api/v1/venues', {
        params: { query: { is_active: true } },
        headers: bearer(token),
      }),
    ),
    200,
    es.lab.setup.venues,
  )
  let best: LabRoom | null = null
  for (const venue of venues) {
    const rooms = must(
      await send(
        labApi.GET('/api/v1/venues/{venue_id}/rooms', {
          params: { path: { venue_id: venue.id } },
          headers: bearer(token),
        }),
      ),
      200,
      es.lab.setup.venues,
    )
    for (const room of rooms) {
      if (room.is_active && (!best || room.capacity > best.capacity)) {
        best = { venueId: venue.id, roomId: room.id, capacity: room.capacity }
      }
    }
  }
  if (!best) throw new LabSetupError(es.lab.noRoom)
  return best
}

/**
 * A random day one to four years ahead: lab events never clash with real ones,
 * nor their talks with each other, in the shared rooms.
 */
export function labSchedule(random = Math.random) {
  const day = Math.floor(Date.now() / DAY) + 400 + Math.floor(random() * 1000)
  const start = day * DAY + 13 * HOUR
  return {
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(start + 8 * HOUR).toISOString(),
  }
}

export async function createEvent(
  organizer: Account,
  {
    title,
    capacity,
    venueId,
    publish,
    closedRegistration = false,
  }: {
    title: string
    capacity: number
    venueId: number | null
    publish: boolean
    closedRegistration?: boolean
  },
): Promise<Event> {
  const event = must(
    await send(
      labApi.POST('/api/v1/events', {
        body: {
          title,
          capacity,
          venue_id: venueId,
          timezone: 'America/Bogota',
          ...labSchedule(),
          // Already closed: registering must fail; cancelling must not.
          registration_closes_at: closedRegistration
            ? new Date(Date.now() - 60_000).toISOString()
            : null,
        },
        headers: bearer(organizer.token),
      }),
    ),
    201,
    es.lab.setup.event,
  )
  if (!publish) return event
  return must(
    await send(
      labApi.POST('/api/v1/events/{event_id}/publish', {
        params: { path: { event_id: event.id } },
        headers: bearer(organizer.token),
      }),
    ),
    200,
    es.lab.setup.publish,
  )
}

export async function createSession(
  organizer: Account,
  event: Event,
  { roomId, schedule }: { roomId: number | null; schedule: boolean },
) {
  const session = must(
    await send(
      labApi.POST('/api/v1/events/{event_id}/sessions', {
        params: { path: { event_id: event.id } },
        body: {
          title: 'Lab session',
          capacity: 10,
          starts_at: event.starts_at,
          ends_at: new Date(Date.parse(event.starts_at) + HOUR).toISOString(),
          room_id: roomId,
        },
        headers: bearer(organizer.token),
      }),
    ),
    201,
    es.lab.setup.session,
  )
  if (!schedule) return session
  return must(
    await send(
      labApi.POST('/api/v1/sessions/{session_id}/schedule', {
        params: { path: { session_id: session.id } },
        headers: bearer(organizer.token),
      }),
    ),
    200,
    es.lab.setup.schedule,
  )
}

/** Cleanup: cancelling frees rooms and seats. Best effort: its result is ignored. */
export async function cancelEvent(organizer: Account, eventId: number) {
  await send(
    labApi.POST('/api/v1/events/{event_id}/cancel', {
      params: { path: { event_id: eventId } },
      headers: bearer(organizer.token),
    }),
  )
}
