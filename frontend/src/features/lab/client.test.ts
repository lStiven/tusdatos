import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { apiError } from '@/test/fixtures'
import { server } from '@/test/server'
import { bearer, describeReply, labApi, send } from './client'

describe('lab client', () => {
  it('answers with status, code and data, never throwing', async () => {
    let auth: string | null = null
    server.use(
      http.get('/api/v1/users/me', ({ request }) => {
        auth = request.headers.get('Authorization')
        return apiError(401, 'invalid_token')
      }),
    )

    const reply = await send(
      labApi.GET('/api/v1/users/me', { headers: bearer('lab-token') }),
    )

    expect(reply).toEqual({
      status: 401,
      code: 'invalid_token',
      data: undefined,
    })
    expect(describeReply(reply)).toBe('401 invalid_token')
    // Its own token, not the tab's session.
    expect(auth).toBe('Bearer lab-token')
  })

  it('turns a network failure into status 0', async () => {
    server.use(http.get('/api/v1/users/me', () => HttpResponse.error()))

    const reply = await send(labApi.GET('/api/v1/users/me'))

    expect(reply).toEqual({ status: 0, code: 'network_error', data: undefined })
    expect(describeReply({ status: 204, code: null, data: undefined })).toBe(
      '204',
    )
  })
})
