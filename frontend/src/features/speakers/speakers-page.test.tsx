import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { components } from '@/api/schema'
import { es } from '@/i18n/es'
import {
  apiError,
  attendee,
  makeSpeaker,
  organizer,
  page,
} from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

type SpeakerInput = components['schemas']['SpeakerCreate']
const t = es.speakers

function serveSpeakers() {
  server.use(
    http.get('/api/v1/speakers', () =>
      HttpResponse.json(
        page([makeSpeaker({ email: 'lucia@example.com', bio: 'Architect.' })], {
          limit: 20,
        }),
      ),
    ),
  )
}

describe('SpeakersPage', () => {
  it('creates a speaker, validating the email first', async () => {
    serveSpeakers()
    let body: SpeakerInput | undefined
    server.use(
      http.post('/api/v1/speakers', async ({ request }) => {
        body = (await request.json()) as SpeakerInput
        return HttpResponse.json(makeSpeaker({ id: 2 }), { status: 201 })
      }),
    )
    const { user } = renderApp('/ponentes', { as: organizer })

    await user.click(await screen.findByRole('button', { name: t.create }))
    const dialog = within(await screen.findByRole('dialog'))
    await user.type(dialog.getByLabelText(t.form.fullName), 'Ana Pérez')
    await user.type(dialog.getByLabelText(t.form.email), 'no-es-correo')
    await user.click(dialog.getByRole('button', { name: t.form.save }))
    expect(await dialog.findByText(t.form.validation.email)).toBeInTheDocument()

    await user.clear(dialog.getByLabelText(t.form.email))
    await user.click(dialog.getByRole('button', { name: t.form.save }))

    expect(await screen.findByText(t.created)).toBeInTheDocument()
    expect(body).toEqual({ full_name: 'Ana Pérez', email: null, bio: null })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('edits a speaker, clearing optional fields with null', async () => {
    serveSpeakers()
    let body: SpeakerInput | undefined
    server.use(
      http.patch('/api/v1/speakers/1', async ({ request }) => {
        body = (await request.json()) as SpeakerInput
        return HttpResponse.json(makeSpeaker())
      }),
    )
    const { user } = renderApp('/ponentes', { as: organizer })

    await user.click(
      await screen.findByRole('button', { name: t.edit('Lucía Fernández') }),
    )
    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByLabelText(t.form.email)).toHaveValue('lucia@example.com')
    await user.clear(dialog.getByLabelText(t.form.email))
    await user.clear(dialog.getByLabelText(t.form.bio))
    await user.click(dialog.getByRole('button', { name: t.form.save }))

    expect(await screen.findByText(t.saved)).toBeInTheDocument()
    expect(body).toEqual({
      full_name: 'Lucía Fernández',
      email: null,
      bio: null,
    })
  })

  it('gives focus back to the button that opened the dialog', async () => {
    serveSpeakers()
    const { user } = renderApp('/ponentes', { as: organizer })
    const edit = await screen.findByRole('button', {
      name: t.edit('Lucía Fernández'),
    })

    await user.click(edit)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await waitFor(() => expect(edit).toHaveFocus())
  })

  it('explains why a speaker with sessions cannot be deleted', async () => {
    serveSpeakers()
    server.use(
      http.delete('/api/v1/speakers/1', () =>
        apiError(409, 'speaker_has_sessions'),
      ),
    )
    const { user } = renderApp('/ponentes', { as: organizer })

    await user.click(
      await screen.findByRole('button', { name: t.delete('Lucía Fernández') }),
    )
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent(t.deleteDialog.description)
    await user.click(
      within(dialog).getByRole('button', { name: t.deleteDialog.confirm }),
    )

    expect(
      await screen.findByText(es.errors.byCode.speaker_has_sessions),
    ).toBeInTheDocument()
  })

  it('searches by name through the URL', async () => {
    const names: (string | null)[] = []
    server.use(
      http.get('/api/v1/speakers', ({ request }) => {
        const name = new URL(request.url).searchParams.get('name')
        names.push(name)
        return HttpResponse.json(page(name ? [] : [makeSpeaker()]))
      }),
    )
    const { user, router } = renderApp('/ponentes', { as: organizer })
    await screen.findByText('Lucía Fernández')

    await user.type(screen.getByLabelText(t.search), 'zz')

    expect(
      await screen.findByRole('heading', { name: t.emptyTitle }),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe('?q=zz')
    expect(names).toEqual([null, 'zz'])
  })

  it('is only for organizers and admins', async () => {
    renderApp('/ponentes', { as: attendee })

    expect(
      await screen.findByRole('heading', { name: es.forbidden.title }),
    ).toBeInTheDocument()
  })
})
