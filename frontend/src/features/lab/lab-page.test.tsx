import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { components } from '@/api/schema'
import { es } from '@/i18n/es'
import {
  admin,
  apiError,
  makeEvent,
  makeRegistration,
  makeRoom,
  makeSession,
  makeVenue,
  organizer,
  page,
} from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

type Schemas = components['schemas']
const l = es.lab

/**
 * Just enough of the API for the «Plazos» scenario and the retries race,
 * following their rules. Records who called what, by token.
 */
function fakeApi({ venues = [makeVenue()], registerStatus = 201 } = {}) {
  let nextUser = 10
  let closed = false
  let nextSession = 100
  let booked: number | null = null
  const registrations = new Map<string, Schemas['RegistrationRead']>()
  const calls: { path: string; token: string | null }[] = []
  const token = (request: Request) =>
    request.headers.get('Authorization')?.replace('Bearer ', '') ?? null
  const record = (request: Request) =>
    calls.push({ path: new URL(request.url).pathname, token: token(request) })

  server.use(
    http.post('/api/v1/auth/register', async ({ request }) => {
      const body = (await request.json()) as Schemas['RegisterRequest']
      if (registerStatus !== 201)
        return apiError(registerStatus, 'internal_server_error')
      return HttpResponse.json(
        {
          ...organizer,
          id: nextUser++,
          email: body.email,
          roles: ['ATTENDEE'],
        },
        { status: 201 },
      )
    }),
    http.post('/api/v1/auth/token', async ({ request }) => {
      const form = new URLSearchParams(await request.text())
      return HttpResponse.json({
        access_token: `token-${form.get('username')}`,
        token_type: 'bearer',
        expires_in: 1800,
      })
    }),
    http.put('/api/v1/users/:id/roles/ORGANIZER', ({ request }) => {
      record(request)
      return HttpResponse.json(organizer)
    }),
    http.get('/api/v1/venues', () => HttpResponse.json(venues)),
    http.get('/api/v1/venues/4/rooms', () =>
      HttpResponse.json([
        makeRoom({ id: 7, capacity: 150 }),
        makeRoom({ id: 8, capacity: 300, is_active: false }),
      ]),
    ),
    http.post('/api/v1/events', () =>
      HttpResponse.json(makeEvent({ status: 'DRAFT' }), { status: 201 }),
    ),
    http.post('/api/v1/events/1/publish', () => HttpResponse.json(makeEvent())),
    http.patch('/api/v1/events/1', () => {
      closed = true
      return HttpResponse.json(makeEvent())
    }),
    http.post('/api/v1/events/1/registrations', ({ request }) => {
      record(request)
      const who = token(request) ?? ''
      const existing = registrations.get(who)
      if (existing?.status === 'CONFIRMED') return HttpResponse.json(existing)
      if (closed) return apiError(409, 'registration_closed')
      const created = makeRegistration()
      registrations.set(who, created)
      return HttpResponse.json(created, { status: 201 })
    }),
    http.post('/api/v1/events/1/registrations/me/cancel', ({ request }) => {
      const cancelled = makeRegistration({ status: 'CANCELLED' })
      registrations.set(token(request) ?? '', cancelled)
      return HttpResponse.json(cancelled)
    }),
    http.get('/api/v1/events/1/registrations', () =>
      HttpResponse.json(page([...registrations.values()], { limit: 100 })),
    ),
    http.post('/api/v1/events/1/complete', () =>
      apiError(409, 'event_not_ended'),
    ),
    // Sessions for the same-room race: the first schedule wins.
    http.post('/api/v1/events/1/sessions', () =>
      HttpResponse.json(makeSession({ id: nextSession++, status: 'DRAFT' }), {
        status: 201,
      }),
    ),
    http.post('/api/v1/sessions/:id/schedule', ({ params }) => {
      if (booked !== null) return apiError(409, 'room_not_available')
      booked = Number(params.id)
      return HttpResponse.json(makeSession({ id: booked }))
    }),
    http.get('/api/v1/events/1/sessions', () =>
      HttpResponse.json([makeSession({ id: booked ?? 0 })]),
    ),
    http.post('/api/v1/events/1/cancel', () =>
      HttpResponse.json(makeEvent({ status: 'CANCELLED' })),
    ),
  )
  return calls
}

const card = async (title: string) =>
  (await screen.findByRole('heading', { name: title })).closest<HTMLElement>(
    '[data-slot=card]',
  )!

describe('LabPage', () => {
  it('runs a scenario with its own accounts and compares every step', async () => {
    const calls = fakeApi()
    const { user } = renderApp('/laboratorio', { as: admin })
    const deadlines = within(await card(l.scenarios.deadlines.title))
    // Temporary data is announced before anything runs.
    expect(
      screen.getByText(l.dataWarning('lab.example.com')),
    ).toBeInTheDocument()

    await user.click(deadlines.getByRole('button', { name: l.run }))

    expect(
      await deadlines.findByText(
        /^5 de 5 pasos correctos/,
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument()
    expect(
      within(deadlines.getByRole('table')).getAllByText(l.stepStatus.pass),
    ).toHaveLength(5)
    // Roles are granted with the tab's admin session; everything else uses
    // the temporary accounts' own tokens.
    expect(calls.find((call) => call.path.includes('/roles/'))?.token).toBe(
      'jwt',
    )
    const registrations = calls.filter((call) =>
      call.path.endsWith('/registrations'),
    )
    expect(registrations.length).toBeGreaterThan(0)
    expect(
      registrations.every((call) => call.token?.includes('@lab.example.com')),
    ).toBe(true)
  })

  it.each([
    ['there is no active room', { venues: [] }, l.noRoom],
    [
      'an account cannot be created',
      { registerStatus: 500 },
      /^No se pudo preparar el escenario: registrar lab-/,
    ],
  ])('explains that nothing runs when %s', async (_, options, message) => {
    fakeApi(options)
    const { user } = renderApp('/laboratorio', { as: admin })
    const capacity = within(await card(l.scenarios.capacity.title))
    const race = within(await card(l.races.list.lastSeat.title))

    await user.click(capacity.getByRole('button', { name: l.run }))
    await user.click(race.getByRole('button', { name: l.run }))

    expect(await capacity.findByText(message)).toBeInTheDocument()
    expect(
      within(capacity.getByRole('table')).getAllByText(l.stepStatus.idle),
    ).toHaveLength(10)
    expect(
      await race.findByText(/^La carrera no pudo completarse/),
    ).toBeInTheDocument()
  })

  it('books a room once when talks race for it', async () => {
    fakeApi()
    const { user } = renderApp('/laboratorio', { as: admin })
    const sameRoom = within(await card(l.races.list.sameRoom.title))

    await user.clear(sameRoom.getByLabelText(l.races.users))
    await user.type(sameRoom.getByLabelText(l.races.users), '3')
    await user.click(sameRoom.getByRole('button', { name: l.run }))

    expect(await sameRoom.findByText(l.races.verdict.pass)).toBeInTheDocument()
    expect(sameRoom.getByText('409 room_not_available × 2')).toBeInTheDocument()
  })

  it('runs a race and checks the rules on the result', async () => {
    fakeApi()
    const { user } = renderApp('/laboratorio', { as: admin })
    const retries = within(await card(l.races.list.retries.title))

    await user.clear(retries.getByLabelText(l.races.users))
    await user.type(retries.getByLabelText(l.races.users), '6')
    await user.click(retries.getByRole('button', { name: l.run }))

    expect(await retries.findByText(l.races.verdict.pass)).toBeInTheDocument()
    expect(retries.getByText('200 × 5')).toBeInTheDocument()
    expect(retries.getByText('201 × 1')).toBeInTheDocument()
  })

  it('is only for admins', async () => {
    renderApp('/laboratorio', { as: organizer })

    expect(
      await screen.findByRole('heading', { name: l.adminOnlyTitle }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByText(l.scenariosTitle)).not.toBeInTheDocument(),
    )
  })
})
