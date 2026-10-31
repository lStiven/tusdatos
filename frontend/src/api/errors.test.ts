import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { es } from '@/i18n/es'
import { server } from '@/test/server'
import { api } from './client'
import { ApiError, errorMessage, fieldErrors, unwrap } from './errors'

const me = () => unwrap(api.GET('/api/v1/users/me'))

describe('unwrap', () => {
  it('turns an error body into an ApiError, with Retry-After on 503', async () => {
    server.use(
      http.get('/api/v1/users/me', () =>
        HttpResponse.json(
          { code: 'service_unavailable', message: 'Busy', details: null },
          { status: 503, headers: { 'Retry-After': '5' } },
        ),
      ),
    )
    await expect(me()).rejects.toMatchObject({
      status: 503,
      code: 'service_unavailable',
      message: 'Busy',
      retryAfter: 5,
    })
  })

  it('reports a network failure as network_error', async () => {
    server.use(http.get('/api/v1/users/me', () => HttpResponse.error()))
    await expect(me()).rejects.toMatchObject({
      status: 0,
      code: 'network_error',
    })
  })
})

describe('errorMessage', () => {
  it.each([
    [
      'a known code',
      new ApiError(409, 'room_not_available', 'x'),
      es.errors.byCode.room_not_available,
    ],
    [
      'an unknown code',
      new ApiError(409, 'brand_new_rule', 'API text'),
      'API text',
    ],
    [
      'a 503 with Retry-After',
      new ApiError(503, 'service_unavailable', 'x', [], 5),
      es.errors.retryIn(5),
    ],
    ['a non-API error', new TypeError('boom'), es.errors.unexpected],
  ])('uses the right text for %s', (_, error, expected) => {
    expect(errorMessage(error)).toBe(expected)
  })
})

describe('fieldErrors', () => {
  it('maps 422 details to form fields and ignores other errors', () => {
    const details = [
      { field: 'body.email', message: 'Invalid email', type: 'value_error' },
    ]
    expect(
      fieldErrors(new ApiError(422, 'validation_error', 'x', details)),
    ).toEqual({
      email: 'Invalid email',
    })
    expect(fieldErrors(new ApiError(409, 'email_taken', 'x', details))).toEqual(
      {},
    )
  })
})
