import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { expect, it } from 'vitest'
import { es } from '@/i18n/es'
import { attendee } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

it.each([
  [
    'healthy',
    () => HttpResponse.json({ status: 'ok', checks: { database: true } }),
    es.health.ok,
  ],
  [
    'failing',
    () =>
      HttpResponse.json(
        { status: 'error', checks: { database: false } },
        { status: 503 },
      ),
    es.health.down,
  ],
  ['unreachable', () => HttpResponse.error(), es.health.down],
])('shows the API as %s', async (_, resolver, text) => {
  renderApp('/', { as: attendee })
  server.use(http.get('/health', resolver))
  expect(await screen.findByText(text)).toBeInTheDocument()
})
