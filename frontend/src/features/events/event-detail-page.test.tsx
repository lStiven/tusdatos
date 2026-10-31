import { screen, waitFor, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { components } from '@/api/schema'
import { es } from '@/i18n/es'
import {
  apiError,
  attendee,
  daysFromNow,
  makeEvent,
  makeOccupancy,
  makeRegistration,
  makeSession,
  organizer,
} from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

type Schemas = components['schemas']

/** Serves everything the detail page reads; `registration: null` means not registered. */
function serveDetail({
  event = makeEvent(),
  registration = null,
  sessions = [],
}: {
  event?: Schemas['EventRead']
  registration?: Schemas['RegistrationRead'] | null
  sessions?: Schemas['SessionRead'][]
} = {}) {
  server.use(
    http.get('/api/v1/events/1', () => HttpResponse.json(event)),
    http.get('/api/v1/events/1/occupancy', () =>
      HttpResponse.json(makeOccupancy()),
    ),
    http.get('/api/v1/events/1/registrations/me', () =>
      registration
        ? HttpResponse.json(registration)
        : apiError(404, 'registration_not_found'),
    ),
    http.get('/api/v1/events/1/sessions', () => HttpResponse.json(sessions)),
  )
}

const status = () =>
  within(
    screen
      .getByRole('heading', { name: es.registration.title })
      .closest('[data-slot=card]')!,
  ).getByRole('status')

describe('EventDetailPage', () => {
  it.each([
    [
      'a seat',
      makeRegistration(),
      201,
      es.registration.confirmed,
      es.registration.result.CONFIRMED,
    ],
    [
      'a place in the waitlist',
      makeRegistration({ status: 'WAITLISTED', waitlist_position: 2 }),
      201,
      es.registration.waitlisted(2),
      es.registration.result.WAITLISTED(2),
    ],
    // A retry of a request that already went through: idempotent.
    [
      'the existing registration',
      makeRegistration(),
      200,
      es.registration.confirmed,
      es.registration.result.unchanged,
    ],
  ])(
    'registers and shows %s as decided by the server',
    async (_, result, code, text, notice) => {
      serveDetail()
      let posts = 0
      server.use(
        http.post('/api/v1/events/1/registrations', () => {
          posts++
          server.use(
            http.get('/api/v1/events/1/registrations/me', () =>
              HttpResponse.json(result),
            ),
          )
          return HttpResponse.json(result, { status: code })
        }),
      )
      const { user } = renderApp('/eventos/1', { as: attendee })

      await user.click(
        await screen.findByRole('button', { name: es.registration.register }),
      )

      await waitFor(() => expect(status()).toHaveTextContent(text))
      expect(posts).toBe(1)
      expect(await screen.findByText(notice)).toBeInTheDocument()
    },
  )

  it.each([
    [
      'registration closed',
      makeEvent({ registration_closes_at: daysFromNow(-1) }),
      /Las inscripciones cerraron el/,
    ],
    [
      'event cancelled',
      makeEvent({ status: 'CANCELLED' }),
      es.registration.blocked.CANCELLED,
    ],
  ])('disables registering when %s, saying why', async (_, event, reason) => {
    serveDetail({ event })
    renderApp('/eventos/1', { as: attendee })

    expect(
      await screen.findByRole('button', { name: es.registration.register }),
    ).toBeDisabled()
    expect(screen.getByText(reason)).toBeInTheDocument()
  })

  it('cancels after confirming the effect in a dialog', async () => {
    serveDetail({ registration: makeRegistration() })
    let cancelled = false
    server.use(
      http.post('/api/v1/events/1/registrations/me/cancel', () => {
        cancelled = true
        const result = makeRegistration({ status: 'CANCELLED' })
        server.use(
          http.get('/api/v1/events/1/registrations/me', () =>
            HttpResponse.json(result),
          ),
        )
        return HttpResponse.json(result)
      }),
    )
    const { user } = renderApp('/eventos/1', { as: attendee })

    await user.click(
      await screen.findByRole('button', { name: es.registration.cancel }),
    )
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent(es.registration.dialog.confirmDescription)
    await user.click(
      within(dialog).getByRole('button', { name: es.registration.dialog.keep }),
    )
    expect(cancelled).toBe(false)

    await user.click(
      screen.getByRole('button', { name: es.registration.cancel }),
    )
    await user.click(
      await screen.findByRole('button', {
        name: es.registration.dialog.confirm,
      }),
    )

    await waitFor(() =>
      expect(status()).toHaveTextContent(es.registration.cancelled),
    )
    expect(cancelled).toBe(true)
    expect(
      screen.getByRole('button', { name: es.registration.registerAgain }),
    ).toBeEnabled()
    expect(
      screen.getByText(es.registration.registerAgainHint),
    ).toBeInTheDocument()
  })

  it('does not offer to cancel once the event started', async () => {
    serveDetail({
      event: makeEvent({ starts_at: daysFromNow(-0.1) }),
      registration: makeRegistration(),
    })
    renderApp('/eventos/1', { as: attendee })

    expect(
      await screen.findByText(es.registration.cancellationClosed),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: es.registration.cancel }),
    ).not.toBeInTheDocument()
  })

  it('blocks interest without a confirmed registration, saying why', async () => {
    serveDetail({
      registration: makeRegistration({
        status: 'WAITLISTED',
        waitlist_position: 1,
      }),
      sessions: [makeSession()],
    })
    renderApp('/eventos/1', { as: attendee })

    const button = await screen.findByRole('button', {
      name: es.agenda.interestLabel('Keynote'),
    })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription(es.agenda.blocked.notConfirmed)
  })

  it('marks interest and warns about overlapping interests, without blocking', async () => {
    const dataviz = makeSession({
      id: 2,
      title: 'Dataviz',
      description: 'Charts with Altair.',
      speakers: [{ id: 1, full_name: 'Lucía Fernández' }],
      is_interested: true,
      overdemand: true,
    })
    serveDetail({
      registration: makeRegistration(),
      sessions: [makeSession(), dataviz],
    })
    server.use(
      http.put('/api/v1/sessions/1/interest', () => {
        server.use(
          http.get('/api/v1/events/1/sessions', () =>
            HttpResponse.json([
              makeSession({ is_interested: true, interested: 1 }),
              dataviz,
            ]),
          ),
        )
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderApp('/eventos/1', { as: attendee })
    const button = await screen.findByRole('button', {
      name: es.agenda.interestLabel('Keynote'),
    })

    await user.click(button)

    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(
      await screen.findByText(es.agenda.overlaps('«Dataviz»')),
    ).toBeInTheDocument()
    expect(screen.getByText(es.agenda.interest(1, 50))).toBeInTheDocument()
    expect(screen.getByText(es.agenda.overdemand)).toBeInTheDocument()
    expect(
      screen.getByText(es.agenda.speakers('Lucía Fernández')),
    ).toBeInTheDocument()
  })

  it('rolls the interest back when the API refuses it', async () => {
    serveDetail({ registration: makeRegistration(), sessions: [makeSession()] })
    server.use(
      http.put('/api/v1/sessions/1/interest', () => {
        // The refetch never answers: only the rollback can restore the state.
        server.use(
          http.get('/api/v1/events/1/sessions', () => delay('infinite')),
        )
        return apiError(409, 'session_not_open')
      }),
    )
    const { user } = renderApp('/eventos/1', { as: attendee })
    const button = await screen.findByRole('button', {
      name: es.agenda.interestLabel('Keynote'),
    })

    await user.click(button)

    expect(
      await screen.findByText(es.errors.byCode.session_not_open),
    ).toBeInTheDocument()
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'))
    expect(screen.getByText(es.agenda.interest(0, 50))).toBeInTheDocument()
  })

  it('shows venue and dates, and degrades if the registration cannot load', async () => {
    serveDetail({
      event: makeEvent({
        venue_id: 4,
        starts_at: '2026-11-28T14:00:00Z',
        ends_at: '2026-11-28T23:00:00Z',
        registration_closes_at: '2026-11-27T23:00:00Z',
      }),
    })
    server.use(
      http.get('/api/v1/venues/4', () =>
        HttpResponse.json({
          id: 4,
          name: 'Ágora',
          address: null,
          city: 'Bogotá',
          is_active: true,
        }),
      ),
      http.get('/api/v1/events/1/registrations/me', () =>
        apiError(500, 'internal_server_error'),
      ),
    )
    renderApp('/eventos/1', { as: attendee })

    expect(await screen.findByText('Ágora · Bogotá')).toBeInTheDocument()
    expect(
      screen.getByText(/^28 nov 2026, 9:00\s*–\s*18:00$/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(es.eventDetail.registrationCloses('27 nov 2026, 18:00')),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(es.errors.byCode.internal_server_error),
    ).toBeInTheDocument()
  })

  it.each([
    ['its organizer', organizer, true],
    ['an attendee', attendee, false],
  ])('offers to manage the event only to %s', async (_, user, visible) => {
    serveDetail()
    renderApp('/eventos/1', { as: user })

    await screen.findByRole('heading', { name: 'PyData Bogotá' })
    expect(
      screen.queryByRole('link', { name: es.manage.manage }) !== null,
    ).toBe(visible)
  })

  it("shows someone else's draft as not found", async () => {
    server.use(
      http.get('/api/v1/events/7', () => apiError(404, 'event_not_found')),
    )
    renderApp('/eventos/7', { as: attendee })

    expect(
      await screen.findByRole('heading', {
        name: es.eventDetail.notFoundTitle,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: es.eventDetail.back }),
    ).toHaveAttribute('href', '/eventos')
  })
})
