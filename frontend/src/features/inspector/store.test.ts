import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { recordRequest, redact, useInspectedRequests } from './store'

describe('redact', () => {
  it.each([
    [
      'JSON',
      '{"email":"a@x.com","password":"s3cret","nested":{"access_token":"jwt"}}',
    ],
    ['form data', 'username=a%40x.com&password=s3cret'],
  ])('hides passwords and tokens in %s', (_, body) => {
    const result = redact(body)
    expect(result).toContain('a@x.com')
    expect(result).not.toMatch(/s3cret|jwt/)
  })

  it('keeps bodies that are neither JSON nor form data', () => {
    expect(redact('plain text')).toBe('plain text')
  })
})

it('keeps only the latest 50 requests', () => {
  for (let i = 0; i < 55; i++) {
    recordRequest({
      id: String(i),
      method: 'GET',
      path: `/r/${i}`,
      startedAt: 0,
      durationMs: null,
      status: null,
      code: null,
      requestBody: null,
      responseBody: null,
    })
  }
  const { result } = renderHook(() => useInspectedRequests())
  expect(result.current).toHaveLength(50)
  expect(result.current[0]?.path).toBe('/r/54')
})
