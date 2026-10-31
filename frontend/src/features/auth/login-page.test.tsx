import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { es } from '@/i18n/es'
import { apiError, attendee, handlers } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'
import { endSession } from './session'

async function fillAndSubmit(
  user: ReturnType<typeof renderApp>['user'],
  email: string,
  password: string,
) {
  await user.type(screen.getByLabelText(es.auth.email), email)
  await user.type(screen.getByLabelText(es.auth.password), password)
  await user.click(screen.getByRole('button', { name: es.auth.login }))
}

describe('LoginPage', () => {
  it('logs in with form data and returns to the requested page', async () => {
    let body = ''
    server.use(
      http.post('/api/v1/auth/token', async ({ request }) => {
        body = await request.text()
        return HttpResponse.json({
          access_token: 'jwt',
          token_type: 'bearer',
          expires_in: 1800,
        })
      }),
      handlers.me(attendee),
    )
    const { user, router } = renderApp('/login?next=%2Feventos')

    await fillAndSubmit(user, 'carla@demo.example.com', 'demo1234')

    await waitFor(() => expect(router.state.location.pathname).toBe('/eventos'))
    expect(new URLSearchParams(body).get('username')).toBe(
      'carla@demo.example.com',
    )
  })

  it('explains invalid credentials without leaving the page', async () => {
    server.use(
      http.post('/api/v1/auth/token', () =>
        apiError(401, 'invalid_credentials'),
      ),
    )
    const { user, router } = renderApp('/login')

    await fillAndSubmit(user, 'carla@demo.example.com', 'wrong-pass')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      es.errors.byCode.invalid_credentials,
    )
    expect(router.state.location.pathname).toBe('/login')
  })

  it('validates before calling the API', async () => {
    const { user } = renderApp('/login')
    await user.click(screen.getByRole('button', { name: es.auth.login }))

    expect(
      await screen.findByText(es.auth.validation.email),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(es.auth.email)).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(
      screen.getByText(es.auth.validation.passwordRequired),
    ).toBeInTheDocument()
  })

  it('says the session expired when the API rejected the token', async () => {
    const { router } = renderApp('/', { as: attendee })
    await screen.findByText(es.home.capabilitiesTitle)

    endSession('expired')

    expect(await screen.findByText(es.auth.sessionExpired)).toBeInTheDocument()
    expect(router.state.location.search).toBe('?next=%2F')
  })

  it('logs in with a demo account in one click', async () => {
    let body = ''
    server.use(
      http.post('/api/v1/auth/token', async ({ request }) => {
        body = await request.text()
        return HttpResponse.json({
          access_token: 'jwt',
          token_type: 'bearer',
          expires_in: 1800,
        })
      }),
      handlers.me(attendee),
    )
    const { user, router } = renderApp('/login')

    await user.click(screen.getByRole('button', { name: /^ana/i }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(Object.fromEntries(new URLSearchParams(body))).toMatchObject({
      username: 'ana@demo.example.com',
      password: 'demo1234',
    })
  })
})
