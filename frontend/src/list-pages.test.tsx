import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse, type JsonBodyType } from 'msw'
import { describe, expect, it } from 'vitest'
import { es } from '@/i18n/es'
import { admin, apiError, page } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

// Every list page handles a failed load the same way: what failed and a retry.
describe('list pages', () => {
  it.each([
    ['/eventos', '/api/v1/events', es.events.loadError, es.events.retry],
    [
      '/organizador/eventos',
      '/api/v1/events',
      es.myEvents.loadError,
      es.myEvents.retry,
    ],
    [
      '/mis-inscripciones',
      '/api/v1/users/me/registrations',
      es.myRegistrations.loadError,
      es.myRegistrations.retry,
    ],
    ['/ponentes', '/api/v1/speakers', es.speakers.loadError, es.speakers.retry],
    ['/admin/usuarios', '/api/v1/users', es.users.loadError, es.users.retry],
    // Not paginated: a plain array.
    [
      '/admin/sedes',
      '/api/v1/venues',
      es.venues.loadError,
      es.venues.retry,
      [],
    ],
  ])(
    '%s shows the error and recovers on retry',
    async (path, endpoint, title, retry, empty: JsonBodyType = page([])) => {
      let calls = 0
      server.use(
        http.get(endpoint, () =>
          ++calls === 1
            ? apiError(500, 'internal_server_error')
            : HttpResponse.json(empty),
        ),
      )
      const { user } = renderApp(path, { as: admin })

      expect(
        await screen.findByRole('heading', { name: title }),
      ).toBeInTheDocument()
      expect(
        screen.getByText(es.errors.byCode.internal_server_error),
      ).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: retry }))

      await waitFor(() =>
        expect(
          screen.queryByRole('heading', { name: title }),
        ).not.toBeInTheDocument(),
      )
      expect(calls).toBe(2)
    },
  )
})
