import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { api } from '@/api/client'
import { describe, expect, it } from 'vitest'
import { startSession } from '@/features/auth/session'
import { es } from '@/i18n/es'
import type { User } from '@/lib/permissions'
import { admin, apiError, attendee, handlers, organizer } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

async function sidebarLinks() {
  const [sidebar] = await screen.findAllByRole('navigation', {
    name: es.a11y.mainNav,
  })
  return within(sidebar!)
    .getAllByRole('link')
    .map((link) => link.textContent)
}

describe('AppShell', () => {
  it.each<[string, User, string[], string[]]>([
    [
      'attendee',
      attendee,
      [es.nav.events, es.nav.myRegistrations],
      [es.nav.myEvents, es.nav.users],
    ],
    [
      'organizer',
      organizer,
      [es.nav.myEvents, es.nav.speakers],
      [es.nav.venues, es.nav.users],
    ],
    ['admin', admin, [es.nav.myEvents, es.nav.venues, es.nav.users], []],
  ])('shows the %s only their sections', async (_, user, visible, hidden) => {
    renderApp('/', { as: user })
    const links = await sidebarLinks()
    for (const label of visible) expect(links).toContain(label)
    for (const label of hidden) expect(links).not.toContain(label)
  })

  it('sends anonymous visitors to the login, keeping the destination', async () => {
    const { router } = renderApp('/admin/usuarios')
    expect(
      await screen.findByRole('heading', { name: es.auth.loginTitle }),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe('?next=%2Fadmin%2Fusuarios')
  })

  it('shows a 403 page when the role is missing', async () => {
    renderApp('/admin/usuarios', { as: organizer })
    expect(
      await screen.findByRole('heading', { name: es.forbidden.title }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(es.forbidden.description(es.roles.ADMIN)),
    ).toBeInTheDocument()
  })

  it('logs out from the user menu', async () => {
    const { user, router } = renderApp('/', { as: attendee })
    await user.click(
      await screen.findByRole('button', { name: es.userMenu.label }),
    )
    await user.click(
      await screen.findByRole('menuitem', { name: es.userMenu.logout }),
    )

    expect(await screen.findByText(es.auth.loggedOut)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('offers a retry when the profile cannot load', async () => {
    startSession('jwt', 1800)
    server.use(
      http.get('/api/v1/users/me', () =>
        apiError(500, 'internal_server_error'),
      ),
    )
    const { user } = renderApp('/')

    const retry = await screen.findByRole('button', {
      name: es.loadError.retry,
    })
    server.use(handlers.me(attendee))
    await user.click(retry)

    expect(
      await screen.findByText(es.home.capabilitiesTitle),
    ).toBeInTheDocument()
  })

  it('lists API calls in the inspector with their outcome', async () => {
    server.use(
      http.get('/api/v1/events', () => apiError(503, 'service_unavailable')),
      http.get('/api/v1/venues', () => HttpResponse.error()),
    )
    const { user } = renderApp('/', { as: attendee })
    await screen.findByText(es.home.capabilitiesTitle)
    await Promise.allSettled([
      api.GET('/api/v1/events'),
      api.GET('/api/v1/venues'),
    ])
    await user.click(screen.getByRole('button', { name: es.inspector.open }))

    const panel = await screen.findByRole('dialog', {
      name: es.inspector.title,
    })
    expect(within(panel).getByText('/api/v1/users/me')).toBeInTheDocument()
    expect(within(panel).getByText('service_unavailable')).toBeInTheDocument()
    expect(
      within(panel).getByText(es.inspector.networkError),
    ).toBeInTheDocument()
  })

  it.each([
    ['organizer', organizer, es.home.ownOnly],
    ['admin', admin, es.home.all],
  ])('tells the %s which events they can edit', async (_, user, scope) => {
    renderApp('/', { as: user })
    const item = await screen.findByText(es.home.capabilities['event:manage'])
    expect(item).toHaveTextContent(`(${scope})`)
  })

  it('shows a not-found page for unknown paths', async () => {
    renderApp('/no-existe', { as: attendee })
    expect(
      await screen.findByRole('heading', { name: es.notFound.title }),
    ).toBeInTheDocument()
  })
})
