import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { components } from '@/api/schema'
import { es } from '@/i18n/es'
import {
  apiError,
  makeEvent,
  makeOccupancy,
  makeSession,
  makeVenue,
  organizer,
} from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

type Schemas = components['schemas']
const f = es.eventForm

function serveVenues() {
  server.use(http.get('/api/v1/venues', () => HttpResponse.json([makeVenue()])))
}

/** Everything the manage page reads after saving, so navigation lands cleanly. */
function serveManage(event: Schemas['EventRead']) {
  server.use(
    http.get(`/api/v1/events/${event.id}`, () => HttpResponse.json(event)),
    http.get(`/api/v1/events/${event.id}/occupancy`, () =>
      HttpResponse.json(makeOccupancy({ event_id: event.id })),
    ),
    http.get(`/api/v1/events/${event.id}/sessions`, () =>
      HttpResponse.json([]),
    ),
    http.get(`/api/v1/events/${event.id}/registrations`, () =>
      HttpResponse.json({ items: [], total: 0, limit: 20, offset: 0 }),
    ),
  )
}

describe('NewEventPage', () => {
  it('creates a draft with the times of the chosen zone', async () => {
    serveVenues()
    let body: Schemas['EventCreate'] | undefined
    const created = makeEvent({ id: 9, status: 'DRAFT' })
    serveManage(created)
    server.use(
      http.post('/api/v1/events', async ({ request }) => {
        body = (await request.json()) as Schemas['EventCreate']
        return HttpResponse.json(created, { status: 201 })
      }),
    )
    const { user, router } = renderApp('/organizador/eventos/nuevo', {
      as: organizer,
    })

    await user.type(await screen.findByLabelText(f.title), '  PyCon  ')
    await user.type(screen.getByLabelText(f.capacity), '50')
    await user.clear(screen.getByLabelText(f.timezone))
    await user.type(screen.getByLabelText(f.timezone), 'Europe/Madrid')
    await user.type(screen.getByLabelText(f.startsAt), '2027-07-01T09:00')
    await user.type(screen.getByLabelText(f.endsAt), '2027-07-01T18:00')
    await user.click(screen.getByLabelText(f.venue))
    await user.click(
      await screen.findByRole('option', { name: 'Ágora · Bogotá' }),
    )
    await user.click(screen.getByRole('button', { name: f.create }))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organizador/eventos/9'),
    )
    expect(body).toEqual({
      title: 'PyCon',
      description: null,
      capacity: 50,
      timezone: 'Europe/Madrid',
      // Summer time in Madrid: UTC+2.
      starts_at: '2027-07-01T09:00:00+02:00',
      ends_at: '2027-07-01T18:00:00+02:00',
      registration_closes_at: null,
      venue_id: 4,
    })
    expect(await screen.findByText(f.created)).toBeInTheDocument()
  })

  it('validates in the browser before calling the API', async () => {
    serveVenues()
    const { user } = renderApp('/organizador/eventos/nuevo', { as: organizer })

    await user.clear(await screen.findByLabelText(f.timezone))
    await user.type(screen.getByLabelText(f.timezone), 'Mars/Olympus')
    await user.type(screen.getByLabelText(f.capacity), '0')
    await user.type(screen.getByLabelText(f.startsAt), '2027-07-01T09:00')
    await user.type(screen.getByLabelText(f.endsAt), '2027-07-01T08:00')
    await user.type(screen.getByLabelText(f.closesAt), '2027-07-02T08:00')
    await user.click(screen.getByRole('button', { name: f.create }))

    for (const message of [
      f.validation.title,
      f.validation.capacity,
      f.validation.timezone,
      f.validation.endsBeforeStart,
      f.validation.closesAfterEnd,
    ]) {
      expect(await screen.findByText(message)).toBeInTheDocument()
    }
    // No POST handler: a request would fail the test.
  })
})

describe('EditEventPage', () => {
  it('prefills in the event zone and shows a business error on its field', async () => {
    serveVenues()
    const event = makeEvent({
      venue_id: 4,
      starts_at: '2027-03-10T14:00:00Z',
      ends_at: '2027-03-10T23:00:00Z',
    })
    serveManage(event)
    server.use(
      http.get('/api/v1/events/1/occupancy', () =>
        HttpResponse.json(makeOccupancy({ confirmed: 2 })),
      ),
    )
    let body: Schemas['EventUpdate'] | undefined
    server.use(
      http.patch('/api/v1/events/1', async ({ request }) => {
        body = (await request.json()) as Schemas['EventUpdate']
        return apiError(409, 'capacity_below_confirmed')
      }),
    )
    const { user } = renderApp('/organizador/eventos/1/editar', {
      as: organizer,
    })

    expect(await screen.findByLabelText(f.startsAt)).toHaveValue(
      '2027-03-10T09:00',
    )
    expect(
      await screen.findByText(
        new RegExp(f.capacityHint(2).replace('.', '\\.')),
      ),
    ).toBeInTheDocument()
    await user.clear(screen.getByLabelText(f.capacity))
    await user.type(screen.getByLabelText(f.capacity), '1')
    await user.click(screen.getByRole('button', { name: f.save }))

    expect(
      await screen.findByText(es.errors.byCode.capacity_below_confirmed),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(f.capacity)).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(body).toMatchObject({
      capacity: 1,
      starts_at: '2027-03-10T09:00:00-05:00',
      venue_id: 4,
    })
  })

  it('locks the venue while sessions are scheduled, and does not send it', async () => {
    serveVenues()
    const event = makeEvent({ venue_id: 4 })
    serveManage(event)
    server.use(
      http.get('/api/v1/events/1/sessions', () =>
        HttpResponse.json([makeSession()]),
      ),
    )
    let body: Record<string, unknown> | undefined
    server.use(
      http.patch('/api/v1/events/1', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(event)
      }),
    )
    const { user, router } = renderApp('/organizador/eventos/1/editar', {
      as: organizer,
    })

    await waitFor(() => expect(screen.getByLabelText(f.venue)).toBeDisabled())
    expect(screen.getByText(f.venueLocked)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: f.save }))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organizador/eventos/1'),
    )
    expect(body).not.toHaveProperty('venue_id')
  })

  it.each([
    ['a finished event', makeEvent({ status: 'COMPLETED' }), f.notEditable],
    [
      'an event of another organizer',
      makeEvent({ owner_id: 99 }),
      es.manage.forbiddenDescription,
    ],
  ])('does not offer to edit %s', async (_, event, message) => {
    serveVenues()
    server.use(http.get('/api/v1/events/1', () => HttpResponse.json(event)))
    renderApp('/organizador/eventos/1/editar', { as: organizer })

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByLabelText(f.title)).not.toBeInTheDocument()
  })
})
