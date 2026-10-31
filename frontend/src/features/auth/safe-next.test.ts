import { expect, it } from 'vitest'
import { safeNext } from './safe-next'

it.each([
  ['/eventos?page=2', '/eventos?page=2'],
  [null, '/'],
  ['//evil.example.com', '/'],
  ['https://evil.example.com', '/'],
])('safeNext(%s) → %s', (next, expected) => {
  expect(safeNext(next)).toBe(expected)
})
