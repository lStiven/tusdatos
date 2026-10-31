import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { es } from '@/i18n/es'
import {
  apiError,
  attendee,
  makeEvent,
  makeOccupancy,
  organizer,
  page,
} from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

/** Serves `/events` and records the query string of every call. */
function serveEvents(respond: (query: URLSearchParams) => Response) {
  const queries: URLSearchParams[] = []
  server.use(
    http.get('/api/v1/events', ({ request }) => {
      const query = new URL(request.url).searchParams
      queries.push(query)
      return respond(query)
    }),
    http.get('/api/v1/events/:id/occupancy', () =>
      HttpResponse.json(
        makeOccupancy({ confirmed: 3, occupancy_percent: 100, waitlisted: 2 }),
      ),
    ),
  )
  return queries
}

describe('EventsPage', () => {
  it('lists events with their status and seats, linking to the detail', async () => {
    serveEvents(() =>
      HttpResponse.json(
        page([
          makeEvent(),
          makeEvent({ id: 2, title: 'Hackathon', status: 'CANCELLED' }),
        ]),
      ),
    )
    renderApp('/eventos', { as: attendee })

    const link = await screen.findByRole('link', { name: 'PyData Bogotá' })
    expect(link).toHaveAttribute('href', '/eventos/1')
    expect(screen.getByText(es.status.event.CANCELLED)).toBeInTheDocument()
    // Only open events load their occupancy.
    expect(
      await screen.findByText(es.occupancy.waitlisted(2)),
    ).toBeInTheDocument()
    expect(screen.getAllByText(es.occupancy.waitlisted(2))).toHaveLength(1)
  })

  it('sends the URL filters to the API and the search box updates them', async () => {
    const queries = serveEvents(() => HttpResponse.json(page([makeEvent()])))
    const { user, router } = renderApp('/eventos?estado=COMPLETED&desde=12', {
      as: organizer,
    })

    await screen.findByText('PyData Bogotá')
    expect(Object.fromEntries(queries[0]!)).toEqual({
      status: 'COMPLETED',
      limit: '12',
      offset: '12',
    })

    await user.type(screen.getByLabelText(es.events.search), '100%')
    // Debounced: one request with the whole term, back to the first page.
    await waitFor(() =>
      expect(router.state.location.search).toBe('?estado=COMPLETED&q=100%25'),
    )
    await waitFor(() => expect(queries.at(-1)?.get('title')).toBe('100%'))
    expect(queries.filter((query) => query.has('title'))).toHaveLength(1)
  })

  it('pages through the results', async () => {
    serveEvents((query) =>
      HttpResponse.json(
        page([makeEvent({ id: Number(query.get('offset')) + 1 })], {
          total: 20,
          offset: Number(query.get('offset')),
        }),
      ),
    )
    const { user, router } = renderApp('/eventos', { as: attendee })

    const nav = await screen.findByRole('navigation', {
      name: es.pagination.label,
    })
    expect(
      within(nav).getByText(es.pagination.range(1, 12, 20)),
    ).toBeInTheDocument()
    expect(
      within(nav).getByRole('button', { name: es.pagination.previous }),
    ).toBeDisabled()

    await user.click(
      within(nav).getByRole('button', { name: es.pagination.next }),
    )

    expect(
      await screen.findByText(es.pagination.range(13, 20, 20)),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe('?desde=12')
    expect(
      screen.getByRole('button', { name: es.pagination.next }),
    ).toBeDisabled()
  })

  it('offers to clear the filters when nothing matches', async () => {
    serveEvents(() => HttpResponse.json(page([])))
    const { user, router } = renderApp('/eventos?q=nada', { as: attendee })

    await user.click(
      await screen.findByRole('button', { name: es.events.clearFilters }),
    )

    expect(router.state.location.search).toBe('')
    expect(
      screen.getByRole('heading', { name: es.events.emptyTitle }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: es.events.clearFilters }),
    ).not.toBeInTheDocument()
  })

  it('shows the error with a retry', async () => {
    let calls = 0
    serveEvents(() =>
      ++calls === 1
        ? apiError(500, 'internal_server_error')
        : HttpResponse.json(page([makeEvent()])),
    )
    const { user } = renderApp('/eventos', { as: attendee })

    expect(
      await screen.findByText(es.errors.byCode.internal_server_error),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: es.events.retry }))

    expect(await screen.findByText('PyData Bogotá')).toBeInTheDocument()
  })
})
