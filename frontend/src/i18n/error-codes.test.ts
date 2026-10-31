import { describe, expect, it } from 'vitest'
import schema from '@/api/schema.d.ts?raw'
import { es } from './es'

// The generated schema lists each documented error as «- `code`: description».
const documented = [...schema.matchAll(/^\s*\*\s+- `([a-z_]+)`: /gm)].map(
  ([, code]) => code!,
)

describe('error codes', () => {
  it('has a Spanish text for every error code the API documents', () => {
    // Guards the parsing itself: an empty list would pass anything.
    expect(documented.length).toBeGreaterThan(40)
    const missing = [...new Set(documented)].filter(
      (code) => !(code in es.errors.byCode),
    )
    expect(missing).toEqual([])
  })
})
