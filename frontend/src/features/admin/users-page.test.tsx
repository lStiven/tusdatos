import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { es } from '@/i18n/es'
import type { User } from '@/lib/permissions'
import { admin, apiError, attendee, organizer, page } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

const t = es.users
const organizerSwitch = (user: User) =>
  screen.findByRole('switch', {
    name: t.roleSwitch(es.roles.ORGANIZER, user.full_name),
  })

/** Serves the user list; `users` can change between calls (after a grant). */
function serveUsers(users: () => User[]) {
  const queries: URLSearchParams[] = []
  server.use(
    http.get('/api/v1/users', ({ request }) => {
      queries.push(new URL(request.url).searchParams)
      return HttpResponse.json(page(users(), { limit: 20 }))
    }),
  )
  return queries
}

describe('UsersPage', () => {
  it('grants a role at once', async () => {
    let carla = attendee
    serveUsers(() => [admin, carla])
    const calls: string[] = []
    server.use(
      http.put('/api/v1/users/1/roles/ORGANIZER', () => {
        calls.push('PUT')
        carla = { ...attendee, roles: ['ATTENDEE', 'ORGANIZER'] }
        return HttpResponse.json(carla)
      }),
    )
    const { user } = renderApp('/admin/usuarios', { as: admin })

    const toggle = await organizerSwitch(attendee)
    expect(toggle).not.toBeChecked()
    await user.click(toggle)

    expect(
      await screen.findByText(t.granted('organizador', attendee.full_name)),
    ).toBeInTheDocument()
    await waitFor(() => expect(toggle).toBeChecked())
    expect(calls).toEqual(['PUT'])
  })

  it('asks before revoking, and explains why the last admin stays', async () => {
    serveUsers(() => [admin])
    const calls: string[] = []
    server.use(
      http.delete('/api/v1/users/3/roles/ADMIN', () => {
        calls.push('DELETE')
        return apiError(409, 'last_admin')
      }),
    )
    const { user } = renderApp('/admin/usuarios', { as: admin })

    await user.click(
      await screen.findByRole('switch', {
        name: t.roleSwitch(es.roles.ADMIN, admin.full_name),
      }),
    )
    const dialog = await screen.findByRole('alertdialog')
    // Revoking your own admin role says you will lose this page.
    expect(dialog).toHaveTextContent(t.revokeDialog.self)
    await user.click(
      within(dialog).getByRole('button', { name: t.revokeDialog.keep }),
    )
    expect(calls).toEqual([])

    await user.click(
      screen.getByRole('switch', {
        name: t.roleSwitch(es.roles.ADMIN, admin.full_name),
      }),
    )
    await user.click(
      await screen.findByRole('button', { name: t.revokeDialog.confirm }),
    )

    expect(
      await screen.findByText(es.errors.byCode.last_admin),
    ).toBeInTheDocument()
    expect(calls).toEqual(['DELETE'])
  })

  it('filters by role and email through the URL', async () => {
    const queries = serveUsers(() => [organizer])
    const { user, router } = renderApp('/admin/usuarios?rol=ORGANIZER', {
      as: admin,
    })

    await organizerSwitch(organizer)
    expect(queries[0]?.get('role')).toBe('ORGANIZER')
    await user.type(screen.getByLabelText(t.search), 'ana')

    await waitFor(() => expect(queries.at(-1)?.get('email')).toBe('ana'))
    expect(router.state.location.search).toBe('?rol=ORGANIZER&q=ana')

    await user.clear(screen.getByLabelText(t.search))
    await waitFor(() =>
      expect(router.state.location.search).toBe('?rol=ORGANIZER'),
    )
  })

  it('is only for admins', async () => {
    renderApp('/admin/usuarios', { as: organizer })

    expect(
      await screen.findByRole('heading', { name: es.forbidden.title }),
    ).toBeInTheDocument()
  })
})
