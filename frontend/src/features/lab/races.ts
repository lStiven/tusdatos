import { bearer, labApi, send, type Reply } from './client'
import {
  lastSeatChecks,
  retriesChecks,
  sameRoomChecks,
  type Outcome,
  type RaceCheck,
} from './race-checks'
import type { LabEnv } from './scenarios'
import {
  cancelEvent,
  createAccounts,
  createEvent,
  createSession,
  findRoom,
  grantOrganizer,
  type Account,
} from './setup'

export type RaceId = 'lastSeat' | 'retries' | 'sameRoom'

export interface RaceParams {
  /** Concurrent requests (and accounts, in `lastSeat`). */
  n: number
  /** Seats of the event (`lastSeat` only). */
  capacity: number
}

export interface RaceResult {
  outcomes: Outcome[]
  checks: RaceCheck[]
  /** From the first request sent to the last answer received. */
  durationMs: number
}

export type RaceProgress =
  | { phase: 'accounts'; done: number; total: number }
  | { phase: 'preparing' | 'firing' | 'verifying' }

/** Fires every request at once and times each one. */
async function fire(requests: (() => Promise<Reply<unknown>>)[]) {
  const started = performance.now()
  const outcomes = await Promise.all(
    requests.map(async (request) => {
      const begun = performance.now()
      const reply = await request()
      return {
        status: reply.status,
        code: reply.code,
        ms: performance.now() - begun,
      }
    }),
  )
  return { outcomes, durationMs: performance.now() - started }
}

async function eventRegistrations(organizer: Account, eventId: number) {
  const reply = await send(
    labApi.GET('/api/v1/events/{event_id}/registrations', {
      params: { path: { event_id: eventId }, query: { limit: 100 } },
      headers: bearer(organizer.token),
    }),
  )
  return reply.data?.items ?? []
}

async function prepareEvent(
  env: LabEnv,
  names: string[],
  capacity: number,
  onProgress: (progress: RaceProgress) => void,
) {
  const accounts = await createAccounts(env.stamp, names, (done) =>
    onProgress({ phase: 'accounts', done, total: names.length }),
  )
  onProgress({ phase: 'preparing' })
  const organizer = accounts['org']!
  await grantOrganizer(env.adminToken, organizer)
  const room = await findRoom(organizer.token)
  const event = await createEvent(organizer, {
    title: `Lab ${env.stamp} · race`,
    capacity,
    venueId: room.venueId,
    publish: true,
  })
  return { accounts, organizer, room, event }
}

const registerAs = (account: Account, eventId: number) => () =>
  send(
    labApi.POST('/api/v1/events/{event_id}/registrations', {
      params: { path: { event_id: eventId } },
      headers: bearer(account.token),
    }),
  )

/** C-01: N people go for the last seats at the same instant. */
async function lastSeat(
  env: LabEnv,
  { n, capacity }: RaceParams,
  onProgress: (progress: RaceProgress) => void,
): Promise<RaceResult> {
  const users = Array.from({ length: n }, (_, i) => `u${i + 1}`)
  const { accounts, organizer, event } = await prepareEvent(
    env,
    ['org', ...users],
    capacity,
    onProgress,
  )
  try {
    onProgress({ phase: 'firing' })
    const { outcomes, durationMs } = await fire(
      users.map((name) => registerAs(accounts[name]!, event.id)),
    )
    onProgress({ phase: 'verifying' })
    const registrations = await eventRegistrations(organizer, event.id)
    return {
      outcomes,
      durationMs,
      checks: lastSeatChecks(capacity, outcomes, registrations),
    }
  } finally {
    await cancelEvent(organizer, event.id)
  }
}

/** C-02: one person retries the same registration N times at once. */
async function retries(
  env: LabEnv,
  { n }: RaceParams,
  onProgress: (progress: RaceProgress) => void,
): Promise<RaceResult> {
  const { accounts, organizer, event } = await prepareEvent(
    env,
    ['org', 'user'],
    5,
    onProgress,
  )
  try {
    onProgress({ phase: 'firing' })
    const request = registerAs(accounts['user']!, event.id)
    const { outcomes, durationMs } = await fire(
      Array.from({ length: n }, () => request),
    )
    onProgress({ phase: 'verifying' })
    const registrations = await eventRegistrations(organizer, event.id)
    return {
      outcomes,
      durationMs,
      checks: retriesChecks(outcomes, registrations.length),
    }
  } finally {
    await cancelEvent(organizer, event.id)
  }
}

/** N talks try to book the same room for the same hour at once. */
async function sameRoom(
  env: LabEnv,
  { n }: RaceParams,
  onProgress: (progress: RaceProgress) => void,
): Promise<RaceResult> {
  const { organizer, room, event } = await prepareEvent(
    env,
    ['org'],
    10,
    onProgress,
  )
  try {
    const drafts = []
    for (let i = 0; i < n; i++) {
      drafts.push(
        await createSession(organizer, event, {
          roomId: room.roomId,
          schedule: false,
        }),
      )
    }
    onProgress({ phase: 'firing' })
    const { outcomes, durationMs } = await fire(
      drafts.map(
        (draft) => () =>
          send(
            labApi.POST('/api/v1/sessions/{session_id}/schedule', {
              params: { path: { session_id: draft.id } },
              headers: bearer(organizer.token),
            }),
          ),
      ),
    )
    onProgress({ phase: 'verifying' })
    const sessions = await send(
      labApi.GET('/api/v1/events/{event_id}/sessions', {
        params: { path: { event_id: event.id } },
        headers: bearer(organizer.token),
      }),
    )
    const scheduled =
      sessions.data?.filter((session) => session.status === 'SCHEDULED')
        .length ?? 0
    return {
      outcomes,
      durationMs,
      checks: sameRoomChecks(outcomes, scheduled),
    }
  } finally {
    await cancelEvent(organizer, event.id)
  }
}

export const races: Record<
  RaceId,
  (
    env: LabEnv,
    params: RaceParams,
    onProgress: (progress: RaceProgress) => void,
  ) => Promise<RaceResult>
> = { lastSeat, retries, sameRoom }
