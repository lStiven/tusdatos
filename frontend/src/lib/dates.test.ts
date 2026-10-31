import { describe, expect, it } from 'vitest'
import { dateTile, dayKey, formatRange, formatTime } from './dates'

describe('dates', () => {
  // 2026-11-29 03:00 UTC is still the 28th, at 22:00, in Bogotá (UTC-5).
  const lateNight = '2026-11-29T03:00:00Z'

  it('shows times in the event zone, not the browser one', () => {
    expect(formatTime(lateNight, 'America/Bogota')).toBe('22:00')
    expect(dateTile(lateNight, 'America/Bogota')).toEqual({
      month: 'nov',
      day: '28',
    })
    expect(dayKey(lateNight, 'America/Bogota')).toBe('2026-11-28')
    expect(dayKey(lateNight, 'Europe/Madrid')).toBe('2026-11-29')
  })

  it('shortens a same-day range and keeps both dates otherwise', () => {
    expect(
      formatRange(
        '2026-11-28T14:00:00Z',
        '2026-11-28T23:00:00Z',
        'America/Bogota',
      ),
    ).toMatch(/^28 nov 2026, 9:00\s*–\s*18:00$/)
    expect(
      formatRange(
        '2026-12-13T14:00:00Z',
        '2026-12-14T23:00:00Z',
        'America/Bogota',
      ),
    ).toMatch(/13 dic 2026.*14 dic 2026/)
  })
})
