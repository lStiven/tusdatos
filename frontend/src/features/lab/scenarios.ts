import type { components } from '@/api/schema'
import { es } from '@/i18n/es'
import { all, expectRegistration, expectReply, type Check } from './checks'
import { bearer, describeReply, labApi, send } from './client'
import {
  cancelEvent,
  createAccounts,
  createEvent,
  createSession,
  findRoom,
  grantOrganizer,
  LabSetupError,
  type Account,
} from './setup'

type Schemas = components['schemas']
type Event = Schemas['EventRead']

export interface LabEnv {
  /** The tab's admin token: only used to grant roles and as «admin». */
  adminToken: string
  stamp: string
  /** Accounts are created one by one, and slowly: report each one. */
  onAccount?: (done: number, total: number) => void
}

export interface Scenario<C> {
  prepare: (env: LabEnv) => Promise<C>
  /** In order; their texts live in `es.lab.scenarios[id].steps`, same order. */
  steps: ((ctx: C) => Promise<Check>)[]
  cleanup: (ctx: C) => Promise<void>
}

// Calls ------------------------------------------------------------------

const eventPath = (id: number) => ({ path: { event_id: id } })

const register = (account: Account, event: Event) =>
  send(
    labApi.POST('/api/v1/events/{event_id}/registrations', {
      params: eventPath(event.id),
      headers: bearer(account.token),
    }),
  )

const cancelRegistration = (account: Account, event: Event) =>
  send(
    labApi.POST('/api/v1/events/{event_id}/registrations/me/cancel', {
      params: eventPath(event.id),
      headers: bearer(account.token),
    }),
  )

const myRegistration = (account: Account, event: Event) =>
  send(
    labApi.GET('/api/v1/events/{event_id}/registrations/me', {
      params: eventPath(event.id),
      headers: bearer(account.token),
    }),
  )

const updateEvent = (
  account: Account | string,
  event: Event,
  body: Schemas['EventUpdate'],
) =>
  send(
    labApi.PATCH('/api/v1/events/{event_id}', {
      params: eventPath(event.id),
      body,
      headers: bearer(typeof account === 'string' ? account : account.token),
    }),
  )

const transition = (
  account: Account,
  event: Event,
  action: 'publish' | 'complete',
) =>
  send(
    action === 'publish'
      ? labApi.POST('/api/v1/events/{event_id}/publish', {
          params: eventPath(event.id),
          headers: bearer(account.token),
        })
      : labApi.POST('/api/v1/events/{event_id}/complete', {
          params: eventPath(event.id),
          headers: bearer(account.token),
        }),
  )

const markInterest = (account: Account, sessionId: number) =>
  send(
    labApi.PUT('/api/v1/sessions/{session_id}/interest', {
      params: { path: { session_id: sessionId } },
      headers: bearer(account.token),
    }),
  )

async function interestedIn(account: Account, event: Event, sessionId: number) {
  const reply = await send(
    labApi.GET('/api/v1/events/{event_id}/sessions', {
      params: eventPath(event.id),
      headers: bearer(account.token),
    }),
  )
  return reply.data?.find((session) => session.id === sessionId)?.interested
}

async function organizerWith<K extends string>(
  env: LabEnv,
  names: readonly K[],
  organizers: readonly K[],
) {
  const accounts = await createAccounts(env.stamp, names, (done) =>
    env.onAccount?.(done, names.length),
  )
  for (const name of organizers) {
    await grantOrganizer(env.adminToken, accounts[name])
  }
  return accounts
}

// Scenarios --------------------------------------------------------------

interface CapacityCtx {
  acc: Record<'org' | 'a1' | 'a2' | 'a3' | 'a4', Account>
  event: Event
}

/** RF-06 to RF-10: never more confirmed than seats, and a FIFO queue. */
const capacity: Scenario<CapacityCtx> = {
  prepare: async (env) => {
    const acc = await organizerWith(
      env,
      ['org', 'a1', 'a2', 'a3', 'a4'],
      ['org'],
    )
    const room = await findRoom(acc.org.token)
    const event = await createEvent(acc.org, {
      title: `Lab ${env.stamp} · capacity`,
      capacity: 2,
      venueId: room.venueId,
      publish: true,
    })
    return { acc, event }
  },
  steps: [
    async ({ acc, event }) =>
      expectRegistration(await register(acc.a1, event), 201, 'CONFIRMED'),
    async ({ acc, event }) =>
      expectRegistration(await register(acc.a2, event), 201, 'CONFIRMED'),
    async ({ acc, event }) =>
      expectRegistration(await register(acc.a3, event), 201, 'WAITLISTED', 1),
    async ({ acc, event }) =>
      expectRegistration(await register(acc.a4, event), 201, 'WAITLISTED', 2),
    async ({ acc, event }) =>
      expectRegistration(await register(acc.a3, event), 200, 'WAITLISTED', 1),
    async ({ acc, event }) => {
      const reply = await send(
        labApi.GET('/api/v1/events/{event_id}/registrations', {
          params: { ...eventPath(event.id), query: { status: 'WAITLISTED' } },
          headers: bearer(acc.org.token),
        }),
      )
      const order = reply.data?.items.map((item) => item.user.id) ?? []
      const names = order.map((id) =>
        id === acc.a3.id ? 'a3' : id === acc.a4.id ? 'a4' : '?',
      )
      return {
        ok:
          reply.status === 200 &&
          order.join() === [acc.a3.id, acc.a4.id].join(),
        got: `${reply.status} [${names.join(', ')}]`,
      }
    },
    async ({ acc, event }) =>
      all(
        expectReply(await cancelRegistration(acc.a1, event), 200),
        expectRegistration(
          await myRegistration(acc.a3, event),
          200,
          'CONFIRMED',
        ),
      ),
    async ({ acc, event }) =>
      expectReply(
        await updateEvent(acc.org, event, { capacity: 1 }),
        409,
        'capacity_below_confirmed',
      ),
    async ({ acc, event }) => {
      const update = expectReply(
        await updateEvent(acc.org, event, { capacity: 3 }),
        200,
      )
      const occupancy = await send(
        labApi.GET('/api/v1/events/{event_id}/occupancy', {
          params: eventPath(event.id),
          headers: bearer(acc.org.token),
        }),
      )
      const data = occupancy.data
      return all(
        update,
        expectRegistration(
          await myRegistration(acc.a4, event),
          200,
          'CONFIRMED',
        ),
        {
          ok: data?.confirmed === 3 && data.waitlisted === 0,
          got: `${data?.confirmed}/${data?.capacity}, ${data?.waitlisted}`,
        },
      )
    },
    async ({ acc, event }) =>
      expectRegistration(await register(acc.a1, event), 201, 'WAITLISTED', 1),
  ],
  cleanup: ({ acc, event }) => cancelEvent(acc.org, event.id),
}

interface InterestCtx {
  acc: Record<'org' | 'a1' | 'a2', Account>
  event: Event
  scheduled: number
  draft: number
}

/** RF-15 and RF-16: interest is informative, only for confirmed attendees. */
const interest: Scenario<InterestCtx> = {
  prepare: async (env) => {
    const acc = await organizerWith(env, ['org', 'a1', 'a2'], ['org'])
    const room = await findRoom(acc.org.token)
    const event = await createEvent(acc.org, {
      title: `Lab ${env.stamp} · interest`,
      capacity: 1,
      venueId: room.venueId,
      publish: true,
    })
    const scheduled = await createSession(acc.org, event, {
      roomId: room.roomId,
      schedule: true,
    })
    const draft = await createSession(acc.org, event, {
      roomId: null,
      schedule: false,
    })
    return { acc, event, scheduled: scheduled.id, draft: draft.id }
  },
  steps: [
    async ({ acc, event }) =>
      expectRegistration(await register(acc.a1, event), 201, 'CONFIRMED'),
    async ({ acc, event }) =>
      expectRegistration(await register(acc.a2, event), 201, 'WAITLISTED', 1),
    async ({ acc, scheduled }) =>
      expectReply(await markInterest(acc.a1, scheduled), 204),
    async ({ acc, event, scheduled }) => {
      const again = expectReply(await markInterest(acc.a1, scheduled), 204)
      const count = await interestedIn(acc.a1, event, scheduled)
      return all(again, { ok: count === 1, got: String(count) })
    },
    async ({ acc, scheduled }) =>
      expectReply(
        await markInterest(acc.a2, scheduled),
        409,
        'registration_not_confirmed',
      ),
    async ({ acc, draft }) =>
      expectReply(
        await send(
          labApi.POST('/api/v1/sessions/{session_id}/schedule', {
            params: { path: { session_id: draft } },
            headers: bearer(acc.org.token),
          }),
        ),
        409,
        'session_requires_room',
      ),
    async ({ acc, event, scheduled }) => {
      const cancel = expectReply(await cancelRegistration(acc.a1, event), 200)
      const count = await interestedIn(acc.org, event, scheduled)
      return all(cancel, { ok: count === 0, got: String(count) })
    },
    async ({ acc, scheduled }) =>
      expectReply(await markInterest(acc.a2, scheduled), 204),
  ],
  cleanup: ({ acc, event }) => cancelEvent(acc.org, event.id),
}

interface DeadlinesCtx {
  acc: Record<'org' | 'a1' | 'a2', Account>
  event: Event
}

/** Registering closes at `registration_closes_at`; cancelling, at the start. */
const deadlines: Scenario<DeadlinesCtx> = {
  prepare: async (env) => {
    const acc = await organizerWith(env, ['org', 'a1', 'a2'], ['org'])
    const room = await findRoom(acc.org.token)
    const event = await createEvent(acc.org, {
      title: `Lab ${env.stamp} · deadlines`,
      capacity: 10,
      venueId: room.venueId,
      publish: true,
    })
    // a1 gets in while it is open; then the organizer closes registration.
    const early = await register(acc.a1, event)
    if (early.status !== 201) {
      throw new LabSetupError(
        es.lab.setupFailed(
          es.lab.setup.earlyRegistration,
          describeReply(early),
        ),
      )
    }
    const closed = await updateEvent(acc.org, event, {
      registration_closes_at: new Date(Date.now() - 60_000).toISOString(),
    })
    if (closed.status !== 200) {
      throw new LabSetupError(
        es.lab.setupFailed(
          es.lab.setup.closeRegistration,
          describeReply(closed),
        ),
      )
    }
    return { acc, event }
  },
  steps: [
    async ({ acc, event }) =>
      expectReply(await register(acc.a2, event), 409, 'registration_closed'),
    async ({ acc, event }) =>
      expectRegistration(await register(acc.a1, event), 200, 'CONFIRMED'),
    async ({ acc, event }) =>
      expectReply(await cancelRegistration(acc.a1, event), 200),
    async ({ acc, event }) =>
      expectReply(await register(acc.a1, event), 409, 'registration_closed'),
    async ({ acc, event }) =>
      expectReply(
        await transition(acc.org, event, 'complete'),
        409,
        'event_not_ended',
      ),
  ],
  cleanup: ({ acc, event }) => cancelEvent(acc.org, event.id),
}

interface OwnershipCtx {
  acc: Record<'org1' | 'org2' | 'a1', Account>
  adminToken: string
  venueId: number
  draft: Event
  published: Event
}

/** RF-02, RF-03, RF-05 and HU-01: statuses, visibility and who may change what. */
const ownership: Scenario<OwnershipCtx> = {
  prepare: async (env) => {
    const acc = await organizerWith(
      env,
      ['org1', 'org2', 'a1'],
      ['org1', 'org2'],
    )
    const room = await findRoom(acc.org1.token)
    const draft = await createEvent(acc.org1, {
      title: `Lab ${env.stamp} · draft`,
      capacity: 10,
      venueId: null,
      publish: false,
    })
    const published = await createEvent(acc.org1, {
      title: `Lab ${env.stamp} · published`,
      capacity: 10,
      venueId: room.venueId,
      publish: true,
    })
    return {
      acc,
      adminToken: env.adminToken,
      venueId: room.venueId,
      draft,
      published,
    }
  },
  steps: [
    async ({ acc, draft }) =>
      expectReply(
        await send(
          labApi.GET('/api/v1/events/{event_id}', {
            params: eventPath(draft.id),
            headers: bearer(acc.org2.token),
          }),
        ),
        404,
        'event_not_found',
      ),
    async ({ acc, draft }) =>
      expectReply(
        await transition(acc.org1, draft, 'publish'),
        409,
        'event_requires_venue',
      ),
    async ({ acc, published }) =>
      expectReply(
        await updateEvent(acc.org2, published, { title: 'Not mine' }),
        403,
        'not_event_owner',
      ),
    async ({ adminToken, published }) =>
      expectReply(
        await updateEvent(adminToken, published, {
          title: `${published.title} (admin)`,
        }),
        200,
      ),
    async ({ acc, draft, venueId }) =>
      all(
        expectReply(
          await updateEvent(acc.org1, draft, { venue_id: venueId }),
          200,
        ),
        expectReply(await transition(acc.org1, draft, 'publish'), 200),
      ),
    async ({ acc, published }) =>
      all(
        expectReply(
          await send(
            labApi.POST('/api/v1/events/{event_id}/cancel', {
              params: eventPath(published.id),
              headers: bearer(acc.org1.token),
            }),
          ),
          200,
        ),
        expectReply(await register(acc.a1, published), 409, 'event_not_open'),
      ),
  ],
  cleanup: async ({ acc, draft, published }) => {
    await cancelEvent(acc.org1, draft.id)
    await cancelEvent(acc.org1, published.id)
  },
}

export const scenarios = { capacity, interest, deadlines, ownership }
export type ScenarioId = keyof typeof scenarios
