import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { components } from '@/api/schema'
import { es } from '@/i18n/es'
import { admin, apiError, makeRoom, makeVenue } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

type Schemas = components['schemas']
const t = es.venues
const r = es.rooms

function serveVenue(rooms: Schemas['RoomRead'][] = [makeRoom()]) {
  server.use(
    http.get('/api/v1/venues/4', () => HttpResponse.json(makeVenue())),
    http.get('/api/v1/venues/4/rooms', () => HttpResponse.json(rooms)),
  )
}

describe('VenuesPage', () => {
  it.each([
    ['', null],
    ['?estado=ACTIVE', 'true'],
    ['?estado=INACTIVE', 'false'],
  ])('lists venues%s asking is_active=%s', async (search, isActive) => {
    let query: URLSearchParams | undefined
    server.use(
      http.get('/api/v1/venues', ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json([makeVenue({ is_active: false })])
      }),
    )
    renderApp(`/admin/sedes${search}`, { as: admin })

    expect(await screen.findByRole('link', { name: 'Ágora' })).toHaveAttribute(
      'href',
      '/admin/sedes/4',
    )
    expect(screen.getByText(t.inactive)).toBeInTheDocument()
    expect(query?.get('is_active')).toBe(isActive)
  })

  it('creates a venue, clearing empty fields', async () => {
    let body: Schemas['VenueCreate'] | undefined
    server.use(
      http.get('/api/v1/venues', () => HttpResponse.json([])),
      http.post('/api/v1/venues', async ({ request }) => {
        body = (await request.json()) as Schemas['VenueCreate']
        return HttpResponse.json(makeVenue({ id: 5 }), { status: 201 })
      }),
    )
    const { user } = renderApp('/admin/sedes', { as: admin })

    await user.click(await screen.findByRole('button', { name: t.create }))
    const dialog = within(await screen.findByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: t.form.save }))
    expect(await dialog.findByText(t.form.validation.name)).toBeInTheDocument()
    await user.type(dialog.getByLabelText(t.form.name), ' Norte ')
    await user.click(dialog.getByRole('button', { name: t.form.save }))

    expect(await screen.findByText(t.created)).toBeInTheDocument()
    expect(body).toEqual({ name: 'Norte', address: null, city: null })
  })
})

describe('VenueDetailPage', () => {
  it('edits the venue, clearing the address with null', async () => {
    serveVenue()
    let body: Schemas['VenueUpdate'] | undefined
    server.use(
      http.get('/api/v1/venues/4', () =>
        HttpResponse.json(makeVenue({ address: 'Cra 7' })),
      ),
      http.patch('/api/v1/venues/4', async ({ request }) => {
        body = (await request.json()) as Schemas['VenueUpdate']
        return HttpResponse.json(makeVenue())
      }),
    )
    const { user } = renderApp('/admin/sedes/4', { as: admin })

    await user.click(await screen.findByRole('button', { name: t.edit }))
    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByLabelText(t.form.address)).toHaveValue('Cra 7')
    await user.clear(dialog.getByLabelText(t.form.address))
    await user.click(dialog.getByRole('button', { name: t.form.save }))

    expect(await screen.findByText(t.saved)).toBeInTheDocument()
    expect(body).toEqual({ name: 'Ágora', address: null, city: 'Bogotá' })
  })

  it('says when the venue does not exist', async () => {
    server.use(
      http.get('/api/v1/venues/9', () => apiError(404, 'venue_not_found')),
    )
    renderApp('/admin/sedes/9', { as: admin })

    expect(
      await screen.findByRole('heading', { name: t.notFound }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t.back })).toHaveAttribute(
      'href',
      '/admin/sedes',
    )
  })

  it('creates a room and shows a taken name on its field', async () => {
    serveVenue()
    const bodies: Schemas['RoomCreate'][] = []
    server.use(
      http.post('/api/v1/venues/4/rooms', async ({ request }) => {
        bodies.push((await request.json()) as Schemas['RoomCreate'])
        return bodies.length === 1
          ? apiError(409, 'room_name_taken')
          : HttpResponse.json(makeRoom({ id: 8 }), { status: 201 })
      }),
    )
    const { user } = renderApp('/admin/sedes/4', { as: admin })

    await user.click(await screen.findByRole('button', { name: r.create }))
    const dialog = within(await screen.findByRole('dialog'))
    await user.type(dialog.getByLabelText(r.form.name), 'Main Auditorium')
    await user.type(dialog.getByLabelText(r.form.capacity), '40')
    await user.click(dialog.getByRole('button', { name: r.form.save }))
    expect(
      await dialog.findByText(es.errors.byCode.room_name_taken),
    ).toBeInTheDocument()
    expect(dialog.getByLabelText(r.form.name)).toHaveAttribute(
      'aria-invalid',
      'true',
    )

    await user.clear(dialog.getByLabelText(r.form.name))
    await user.type(dialog.getByLabelText(r.form.name), 'Room C')
    await user.click(dialog.getByRole('button', { name: r.form.save }))

    expect(await screen.findByText(r.created)).toBeInTheDocument()
    expect(bodies.at(-1)).toEqual({ name: 'Room C', capacity: 40 })
  })

  it('keeps the capacity a scheduled session needs', async () => {
    serveVenue()
    server.use(
      http.patch('/api/v1/venues/4/rooms/7', () =>
        apiError(409, 'room_capacity_below_sessions'),
      ),
    )
    const { user } = renderApp('/admin/sedes/4', { as: admin })

    await user.click(
      await screen.findByRole('button', { name: r.edit('Main Auditorium') }),
    )
    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByLabelText(r.form.capacity)).toHaveValue(150)
    await user.clear(dialog.getByLabelText(r.form.capacity))
    await user.type(dialog.getByLabelText(r.form.capacity), '10')
    await user.click(dialog.getByRole('button', { name: r.form.save }))

    expect(
      await dialog.findByText(es.errors.byCode.room_capacity_below_sessions),
    ).toBeInTheDocument()
  })

  it.each([
    [
      'venue',
      t.activeSwitch('Ágora'),
      '/api/v1/venues/4',
      t.deactivateDialog.description,
      'venue_has_scheduled_sessions',
    ],
    [
      'room',
      r.activeSwitch('Main Auditorium'),
      '/api/v1/venues/4/rooms/7',
      r.deactivateDialog.description,
      'room_has_scheduled_sessions',
    ],
  ])(
    'asks before deactivating a %s and shows why the API refuses',
    async (_, name, path, description, code) => {
      serveVenue()
      let body: unknown
      server.use(
        http.patch(path, async ({ request }) => {
          body = await request.json()
          return apiError(409, code)
        }),
      )
      const { user } = renderApp('/admin/sedes/4', { as: admin })

      await user.click(await screen.findByRole('switch', { name }))
      const dialog = await screen.findByRole('alertdialog')
      expect(dialog).toHaveTextContent(description)
      await user.click(
        within(dialog).getByRole('button', {
          name: t.deactivateDialog.confirm,
        }),
      )

      expect(
        await screen.findByText(
          es.errors.byCode[code as keyof typeof es.errors.byCode],
        ),
      ).toBeInTheDocument()
      expect(body).toEqual({ is_active: false })
      await waitFor(() =>
        expect(screen.getByRole('switch', { name })).toBeChecked(),
      )
    },
  )

  it.each([
    ['venue', t.activeSwitch('Ágora'), '/api/v1/venues/4', t.activated],
    [
      'room',
      r.activeSwitch('Main Auditorium'),
      '/api/v1/venues/4/rooms/7',
      r.activated,
    ],
  ])('activates a %s at once, without asking', async (_, name, path, done) => {
    server.use(
      http.get('/api/v1/venues/4', () =>
        HttpResponse.json(makeVenue({ is_active: false })),
      ),
      http.get('/api/v1/venues/4/rooms', () =>
        HttpResponse.json([makeRoom({ is_active: false })]),
      ),
    )
    let body: unknown
    server.use(
      http.patch(path, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(makeRoom())
      }),
    )
    const { user } = renderApp('/admin/sedes/4', { as: admin })

    await user.click(await screen.findByRole('switch', { name }))

    expect(await screen.findByText(done)).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(body).toEqual({ is_active: true })
  })
})
