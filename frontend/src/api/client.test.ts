import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { logIn } from '@/features/auth/api'
import { getToken, startSession, takeEndReason } from '@/features/auth/session'
import { useInspectedRequests } from '@/features/inspector/store'
import { renderHook } from '@testing-library/react'
import { admin, apiError } from '@/test/fixtures'
import { server } from '@/test/server'
import { api } from './client'

describe('api client', () => {
  it('sends the session token as a Bearer header', async () => {
    let authorization: string | null = null
    server.use(
      http.get('/api/v1/users/me', ({ request }) => {
        authorization = request.headers.get('Authorization')
        return HttpResponse.json(admin)
      }),
    )
    startSession('jwt-123', 60)
    await api.GET('/api/v1/users/me')
    expect(authorization).toBe('Bearer jwt-123')
  })

  it('ends the session when the API rejects its token', async () => {
    server.use(
      http.get('/api/v1/users/me', () => apiError(401, 'token_expired')),
    )
    startSession('jwt', 60)
    await api.GET('/api/v1/users/me')
    expect(getToken()).toBeNull()
    expect(takeEndReason()).toBe('expired')
  })

  it('records requests for the inspector without secrets', async () => {
    server.use(
      http.post('/api/v1/auth/token', () =>
        apiError(401, 'invalid_credentials'),
      ),
    )
    await expect(
      logIn({ email: 'ana@x.com', password: 's3cret!' }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' })
    // A failed login sends no token, so there is no session to end.
    expect(takeEndReason()).toBeNull()

    const { result } = renderHook(() => useInspectedRequests())
    const [entry] = result.current
    expect(entry).toMatchObject({
      method: 'POST',
      path: '/api/v1/auth/token',
      status: 401,
      code: 'invalid_credentials',
    })
    expect(entry?.requestBody).toContain('username=ana@x.com')
    expect(entry?.requestBody).not.toContain('s3cret!')
  })
})
