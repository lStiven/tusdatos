import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { components } from '@/api/schema'
import { es } from '@/i18n/es'
import {
  apiError,
  daysFromNow,
  makeEvent,
  makeOccupancy,
  makeRoom,
  makeSession,
  makeSpeaker,
  organizer,
  page,
} from '@/test/fixtures'
import { pickDateTime } from '@/test/date-time'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

type Schemas = components['schemas']
const m = es.manage
const s = es.sessionsAdmin

function serveManage({
  event = makeEvent({ venue_id: 4 }),
  sessions = [],
  registrations = [],
}: {
  event?: Schemas['EventRead']
  sessions?: Schemas['SessionRead'][]
  registrations?: Schemas['EventRegistrationRead'][]
} = {}) {
  const queries: URLSearchParams[] = []
  server.use(
    http.get('/api/v1/events/1', () => HttpResponse.json(event)),
    http.get('/api/v1/events/1/occupancy', () =>
      HttpResponse.json(makeOccupancy()),
    ),
    http.get('/api/v1/events/1/sessions', () => HttpResponse.json(sessions)),
    http.get('/api/v1/events/1/registrations', ({ request }) => {
      const query = new URL(request.url).searchParams
      queries.push(query)
      const status = query.get('status')
      return HttpResponse.json(
        page(
          registrations.filter((item) => !status || item.status === status),
          { limit: 20 },
        ),
      )
    }),
  )
  return queries
}

function attendeeRow(
  overrides: Partial<Schemas['EventRegistrationRead']> = {},
): Schemas['EventRegistrationRead'] {
  return {
    id: 1,
    event_id: 1,
    status: 'CONFIRMED',
    waitlist_position: null,
    requested_at: daysFromNow(-2),
    confirmed_at: daysFromNow(-2),
    cancelled_at: null,
    user: { id: 5, email: 'elena@demo.example.com', full_name: 'Elena Ruiz' },
    ...overrides,
  }
}

describe('MyEventsPage', () => {
  it('lists only my events, each linking to its management page', async () => {
    let query: URLSearchParams | undefined
    server.use(
      http.get('/api/v1/events', ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json(page([makeEvent({ status: 'DRAFT' })]))
      }),
    )
    renderApp('/organizador/eventos?estado=DRAFT', { as: organizer })

    expect(
      await screen.findByRole('link', { name: 'PyData Bogotá' }),
    ).toHaveAttribute('href', '/organizador/eventos/1')
    expect(query?.get('mine')).toBe('true')
    expect(query?.get('status')).toBe('DRAFT')
  })
})

describe('ManageEventPage', () => {
  it.each([
    [
      'publishes a draft',
      makeEvent({ status: 'DRAFT', venue_id: 4 }),
      m.publish,
      m.publishDialog,
      'publish',
      m.published,
    ],
    [
      'completes an event that ended',
      makeEvent({
        venue_id: 4,
        starts_at: daysFromNow(-2),
        ends_at: daysFromNow(-1),
      }),
      m.complete,
      m.completeDialog,
      'complete',
      m.completed,
    ],
  ])(
    '%s after confirming',
    async (_, event, action, dialogText, path, done) => {
      serveManage({ event })
      const calls: string[] = []
      server.use(
        http.post(`/api/v1/events/1/${path}`, () => {
          calls.push(path)
          return HttpResponse.json(event)
        }),
      )
      const { user } = renderApp('/organizador/eventos/1', { as: organizer })

      await user.click(await screen.findByRole('button', { name: action }))
      const dialog = await screen.findByRole('alertdialog')
      expect(dialog).toHaveTextContent(dialogText.description)
      await user.click(
        within(dialog).getByRole('button', { name: dialogText.confirm }),
      )

      expect(await screen.findByText(done)).toBeInTheDocument()
      expect(calls).toEqual([path])
      expect(screen.getByText(es.attendees.none)).toBeInTheDocument()
    },
  )

  it.each([
    [
      'publish a draft without venue',
      makeEvent({ status: 'DRAFT', venue_id: null }),
      m.publish,
      m.blocked.noVenue,
    ],
    [
      'complete an event that has not ended',
      makeEvent({ venue_id: 4 }),
      m.complete,
      m.blocked.notEnded,
    ],
  ])('does not let %s, saying why', async (_, event, action, reason) => {
    serveManage({ event })
    renderApp('/organizador/eventos/1', { as: organizer })

    expect(await screen.findByRole('button', { name: action })).toBeDisabled()
    expect(screen.getByText(reason)).toBeInTheDocument()
  })

  it('cancels the event only after typing its title', async () => {
    serveManage()
    let cancelled = false
    server.use(
      http.post('/api/v1/events/1/cancel', () => {
        cancelled = true
        return HttpResponse.json(makeEvent({ status: 'CANCELLED' }))
      }),
    )
    const { user } = renderApp('/organizador/eventos/1', { as: organizer })

    await user.click(await screen.findByRole('button', { name: m.cancel }))
    const dialog = await screen.findByRole('alertdialog')
    const confirm = within(dialog).getByRole('button', {
      name: m.cancelDialog.confirm,
    })
    expect(confirm).toBeDisabled()
    await user.type(
      within(dialog).getByLabelText(
        m.cancelDialog.typeToConfirm('PyData Bogotá'),
      ),
      'PyData Bogotá',
    )
    await user.click(confirm)

    expect(await screen.findByText(m.cancelled)).toBeInTheDocument()
    expect(cancelled).toBe(true)
  })

  it("shows a 403 panel on another organizer's event", async () => {
    serveManage({ event: makeEvent({ owner_id: 99 }) })
    renderApp('/organizador/eventos/1', { as: organizer })

    expect(
      await screen.findByRole('heading', { name: m.forbiddenTitle }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: m.cancel }),
    ).not.toBeInTheDocument()
  })

  it('creates a session with its room and speakers, in the event zone', async () => {
    serveManage({
      event: makeEvent({
        venue_id: 4,
        starts_at: '2027-03-10T14:00:00Z',
        ends_at: '2027-03-10T23:00:00Z',
      }),
    })
    let body: Schemas['SessionCreate'] | undefined
    server.use(
      http.get('/api/v1/venues/4/rooms', () =>
        HttpResponse.json([
          makeRoom(),
          makeRoom({ id: 8, name: 'Closed', is_active: false }),
        ]),
      ),
      http.get('/api/v1/speakers', () =>
        HttpResponse.json(
          page([makeSpeaker(), makeSpeaker({ id: 2, full_name: 'Tomás' })]),
        ),
      ),
      http.post('/api/v1/events/1/sessions', async ({ request }) => {
        body = (await request.json()) as Schemas['SessionCreate']
        return HttpResponse.json(makeSession(), { status: 201 })
      }),
    )
    const { user } = renderApp('/organizador/eventos/1', { as: organizer })

    await user.click(await screen.findByRole('button', { name: s.create }))
    const dialog = await screen.findByRole('dialog')
    const d = within(dialog)
    // Defaults to the first hour of the event, in its zone.
    expect(
      d.getByRole('button', { name: es.eventForm.startsAt }),
    ).toHaveTextContent('10 mar 2027, 9:00')
    await user.type(d.getByLabelText(s.form.title), 'Keynote')
    await user.type(d.getByLabelText(s.form.capacity), '200')
    // The list opens in a portal, outside the dialog.
    await user.click(d.getByLabelText(s.form.room))
    const room = await screen.findByRole('option', {
      name: s.form.roomOption('Main Auditorium', 150),
    })
    // Inactive rooms are not offered.
    expect(
      screen.queryByRole('option', { name: /Closed/ }),
    ).not.toBeInTheDocument()
    await user.click(room)
    expect(d.getByText(s.form.capacityOverRoom(150))).toBeInTheDocument()
    await user.clear(d.getByLabelText(s.form.capacity))
    await user.type(d.getByLabelText(s.form.capacity), '100')
    await user.click(await d.findByRole('checkbox', { name: 'Tomás' }))
    await user.click(d.getByRole('button', { name: s.form.save }))

    expect(await screen.findByText(s.created)).toBeInTheDocument()
    expect(body).toEqual({
      title: 'Keynote',
      description: null,
      capacity: 100,
      starts_at: '2027-03-10T09:00:00-05:00',
      ends_at: '2027-03-10T10:00:00-05:00',
      room_id: 7,
      speaker_ids: [2],
    })
  })

  it('does not save a session outside the event dates', async () => {
    serveManage({
      event: makeEvent({
        venue_id: 4,
        starts_at: '2027-03-10T14:00:00Z',
        ends_at: '2027-03-10T23:00:00Z',
      }),
    })
    server.use(
      http.get('/api/v1/venues/4/rooms', () => HttpResponse.json([])),
      http.get('/api/v1/speakers', () => HttpResponse.json(page([]))),
    )
    const { user } = renderApp('/organizador/eventos/1', { as: organizer })

    await user.click(await screen.findByRole('button', { name: s.create }))
    const d = within(await screen.findByRole('dialog'))
    await user.type(d.getByLabelText(s.form.title), 'Late talk')
    await user.type(d.getByLabelText(s.form.capacity), '10')
    await pickDateTime(user, es.eventForm.endsAt, '2027-03-10T19:00')
    await user.click(d.getByRole('button', { name: s.form.save }))

    expect(
      await d.findByText(es.eventForm.validation.outsideEvent),
    ).toBeInTheDocument()
    expect(d.getByText(s.form.noSpeakers)).toBeInTheDocument()
    // No POST handler: a request would fail the test.
  })

  it('schedules a draft, and shows the conflict if the room is taken', async () => {
    serveManage({ sessions: [makeSession({ status: 'DRAFT' })] })
    server.use(
      http.post('/api/v1/sessions/1/schedule', () =>
        apiError(409, 'room_not_available'),
      ),
    )
    const { user } = renderApp('/organizador/eventos/1', { as: organizer })

    await user.click(
      await screen.findByRole('button', { name: s.actions('Keynote') }),
    )
    await user.click(await screen.findByRole('menuitem', { name: s.schedule }))

    expect(
      await screen.findByText(es.errors.byCode.room_not_available),
    ).toBeInTheDocument()
  })

  it('warns that a draft without room cannot be scheduled yet', async () => {
    serveManage({ sessions: [makeSession({ status: 'DRAFT', room: null })] })
    const { user } = renderApp('/organizador/eventos/1', { as: organizer })

    expect(await screen.findByText(s.needsRoom)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: s.actions('Keynote') }))
    expect(
      await screen.findByRole('menuitem', { name: s.schedule }),
    ).toHaveAttribute('aria-disabled', 'true')
  })

  it('edits a session and shows a speaker clash on the speakers field', async () => {
    serveManage({
      sessions: [
        makeSession({ speakers: [{ id: 1, full_name: 'Lucía Fernández' }] }),
      ],
    })
    let body: Schemas['SessionUpdate'] | undefined
    server.use(
      http.get('/api/v1/venues/4/rooms', () => HttpResponse.json([makeRoom()])),
      http.get('/api/v1/speakers', () =>
        HttpResponse.json(page([makeSpeaker()])),
      ),
      http.patch('/api/v1/sessions/1', async ({ request }) => {
        body = (await request.json()) as Schemas['SessionUpdate']
        return apiError(409, 'speaker_not_available')
      }),
    )
    const { user } = renderApp('/organizador/eventos/1', { as: organizer })

    await user.click(
      await screen.findByRole('button', { name: s.actions('Keynote') }),
    )
    await user.click(await screen.findByRole('menuitem', { name: s.edit }))
    const d = within(await screen.findByRole('dialog'))
    expect(d.getByLabelText(s.form.title)).toHaveValue('Keynote')
    expect(
      await d.findByRole('checkbox', { name: 'Lucía Fernández' }),
    ).toBeChecked()
    await user.clear(d.getByLabelText(s.form.title))
    await user.type(d.getByLabelText(s.form.title), 'Opening')
    await user.click(d.getByRole('button', { name: s.form.save }))

    expect(
      await d.findByText(es.errors.byCode.speaker_not_available),
    ).toBeInTheDocument()
    expect(body).toMatchObject({ title: 'Opening', speaker_ids: [1] })
  })

  function serveSessionAction(path: string) {
    serveManage({ sessions: [makeSession()] })
    const calls: string[] = []
    server.use(
      http.post(`/api/v1/sessions/1/${path}`, () => {
        calls.push(path)
        return HttpResponse.json(makeSession())
      }),
    )
    return calls
  }

  async function openMenuItem(
    user: ReturnType<typeof renderApp>['user'],
    name: string,
  ) {
    await user.click(
      await screen.findByRole('button', { name: s.actions('Keynote') }),
    )
    await user.click(await screen.findByRole('menuitem', { name }))
  }

  it('sends a scheduled session back to draft', async () => {
    const calls = serveSessionAction('unschedule')
    const { user } = renderApp('/organizador/eventos/1', { as: organizer })

    await openMenuItem(user, s.unschedule)

    expect(await screen.findByText(s.unscheduled)).toBeInTheDocument()
    expect(calls).toEqual(['unschedule'])
  })

  it('cancels a session after confirming its effect', async () => {
    const calls = serveSessionAction('cancel')
    const { user } = renderApp('/organizador/eventos/1', { as: organizer })

    await openMenuItem(user, s.cancel)
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent(s.cancelDialog.description)
    await user.click(
      within(dialog).getByRole('button', { name: s.cancelDialog.confirm }),
    )

    expect(await screen.findByText(s.cancelledToast)).toBeInTheDocument()
    expect(calls).toEqual(['cancel'])
  })

  it('lists the queue with positions and filters it through the URL', async () => {
    const queries = serveManage({
      registrations: [
        attendeeRow(),
        attendeeRow({
          id: 2,
          status: 'WAITLISTED',
          waitlist_position: 1,
          confirmed_at: null,
          user: {
            id: 6,
            email: 'gabi@demo.example.com',
            full_name: 'Gabriela',
          },
        }),
      ],
    })
    const { user, router } = renderApp('/organizador/eventos/1', {
      as: organizer,
    })

    expect(await screen.findByText('Gabriela')).toBeInTheDocument()
    expect(screen.getByText(es.attendees.position(1))).toBeInTheDocument()
    await user.click(
      screen.getByRole('link', { name: es.myRegistrations.tabs.WAITLISTED }),
    )

    await waitFor(() =>
      expect(screen.queryByText('Elena Ruiz')).not.toBeInTheDocument(),
    )
    expect(queries.at(-1)?.get('status')).toBe('WAITLISTED')
    expect(router.state.location.search).toBe('?estado=WAITLISTED')

    await user.click(
      screen.getByRole('link', { name: es.myRegistrations.tabs.CANCELLED }),
    )
    expect(await screen.findByText(es.attendees.empty)).toBeInTheDocument()
  })
})
