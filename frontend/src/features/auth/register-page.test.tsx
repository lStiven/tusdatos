import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { es } from '@/i18n/es'
import { apiError, attendee, handlers } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

async function fillForm(user: ReturnType<typeof renderApp>['user']) {
  await user.type(screen.getByLabelText(es.auth.fullName), 'Carla Peña')
  await user.type(
    screen.getByLabelText(es.auth.email),
    'carla@demo.example.com',
  )
  await user.type(screen.getByLabelText(es.auth.password), 'demo1234')
  await user.click(screen.getByRole('button', { name: es.auth.register }))
}

describe('RegisterPage', () => {
  it('creates the account and logs in right away', async () => {
    server.use(
      http.post('/api/v1/auth/register', () =>
        HttpResponse.json(attendee, { status: 201 }),
      ),
      handlers.token(),
      handlers.me(attendee),
    )
    const { user, router } = renderApp('/registro')

    await fillForm(user)

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(
      await screen.findByText(es.home.greeting('Carla')),
    ).toBeInTheDocument()
  })

  it.each([
    [
      'a taken email',
      apiError(409, 'email_taken'),
      es.errors.byCode.email_taken,
    ],
    [
      'an API validation error',
      HttpResponse.json(
        {
          code: 'validation_error',
          message: 'Invalid input data',
          details: [
            {
              field: 'body.email',
              message: 'Not a deliverable email',
              type: 'value_error',
            },
          ],
        },
        { status: 422 },
      ),
      'Not a deliverable email',
    ],
  ])('shows %s next to the email field', async (_, response, text) => {
    server.use(http.post('/api/v1/auth/register', () => response))
    const { user } = renderApp('/registro')

    await fillForm(user)

    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.getByLabelText(es.auth.email)).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('rejects a short password before calling the API', async () => {
    const { user } = renderApp('/registro')
    await user.type(screen.getByLabelText(es.auth.password), 'short')
    await user.click(screen.getByRole('button', { name: es.auth.register }))

    expect(
      await screen.findByText(es.auth.validation.passwordLength),
    ).toBeInTheDocument()
  })
})
