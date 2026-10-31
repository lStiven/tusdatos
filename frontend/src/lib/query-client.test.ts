import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/errors'
import { startSession } from '@/features/auth/session'
import { createQueryClient, retryDelay, shouldRetry } from './query-client'

describe('retry policy', () => {
  it.each([
    ['503', new ApiError(503, 'service_unavailable', 'x'), 0, true],
    ['network error', new ApiError(0, 'network_error', 'x'), 1, true],
    [
      '503 after two retries',
      new ApiError(503, 'service_unavailable', 'x'),
      2,
      false,
    ],
    ['409', new ApiError(409, 'conflict', 'x'), 0, false],
    ['401', new ApiError(401, 'token_expired', 'x'), 0, false],
  ])('%s → retry %s', (_, error, failures, expected) => {
    expect(shouldRetry(failures, error)).toBe(expected)
  })

  it('waits Retry-After when present, otherwise backs off', () => {
    expect(
      retryDelay(0, new ApiError(503, 'service_unavailable', 'x', [], 5)),
    ).toBe(5000)
    expect(retryDelay(2, new ApiError(0, 'network_error', 'x'))).toBe(4000)
  })
})

it('drops cached data when the session changes', () => {
  const client = createQueryClient()
  client.setQueryData(['users', 'me'], { id: 1 })
  startSession('other-account', 60)
  expect(client.getQueryData(['users', 'me'])).toBeUndefined()
})
