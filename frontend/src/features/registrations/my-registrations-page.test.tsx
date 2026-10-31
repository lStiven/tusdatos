import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { es } from '@/i18n/es'
import { attendee, makeRegistration, page } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

function serveRegistrations(items = [makeRegistration()]) {
  const statuses: (string | null)[] = []
  server.use(
    http.get('/api/v1/users/me/registrations', ({ request }) => {
      const status = new URL(request.url).searchParams.get('status')
      statuses.push(status)
      return HttpResponse.json(
        page(status ? items.filter((item) => item.status === status) : items, {
          limit: 10,
        }),
      )
    }),
  )
  return statuses
}

describe('MyRegistrationsPage', () => {
  it('shows the registration and event statuses apart, plus the queue position', async () => {
    const base = makeRegistration()
    serveRegistrations([
      makeRegistration({
        status: 'CANCELLED',
        event: { ...base.event, title: 'Hackathon', status: 'CANCELLED' },
      }),
      makeRegistration({
        id: 2,
        status: 'WAITLISTED',
        waitlist_position: 3,
        event: { ...base.event, id: 2 },
      }),
    ])
    renderApp('/mis-inscripciones', { as: attendee })

    const hackathon = (
      await screen.findByRole('link', { name: 'Hackathon' })
    ).closest('li')!
    expect(
      within(hackathon).getByText(es.status.registration.CANCELLED),
    ).toBeInTheDocument()
    expect(
      within(hackathon).getByText(es.status.event.CANCELLED),
    ).toBeInTheDocument()
    expect(screen.getByText(es.myRegistrations.position(3))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'PyData Bogotá' })).toHaveAttribute(
      'href',
      '/eventos/2',
    )
  })

  it('filters by status through the URL', async () => {
    const statuses = serveRegistrations()
    const { user, router } = renderApp('/mis-inscripciones', { as: attendee })
    await screen.findByRole('link', { name: 'PyData Bogotá' })

    await user.click(
      screen.getByRole('link', { name: es.myRegistrations.tabs.WAITLISTED }),
    )

    expect(
      await screen.findByRole('heading', {
        name: es.myRegistrations.emptyTitle,
      }),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe('?estado=WAITLISTED')
    expect(
      screen.getByRole('link', { name: es.myRegistrations.tabs.WAITLISTED }),
    ).toHaveAttribute('aria-current', 'page')
    expect(statuses).toEqual([null, 'WAITLISTED'])
    expect(
      screen.getByRole('link', { name: es.myRegistrations.explore }),
    ).toHaveAttribute('href', '/eventos')
  })
})
