import { describe, expect, it } from 'vitest'
import {
  dateTile,
  dayKey,
  formatRange,
  formatTime,
  formatWallTime,
  fromZonedInput,
  isTimeZone,
  parseWallTime,
  toZonedInput,
} from './dates'

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

describe('zoned inputs', () => {
  it.each([
    ['2026-11-28T09:00', 'America/Bogota', '2026-11-28T09:00:00-05:00'],
    // Madrid changes offset between winter and summer.
    ['2026-01-15T09:30', 'Europe/Madrid', '2026-01-15T09:30:00+01:00'],
    ['2026-07-15T09:30', 'Europe/Madrid', '2026-07-15T09:30:00+02:00'],
    ['2026-07-15T09:30', 'Asia/Kolkata', '2026-07-15T09:30:00+05:30'],
    // An hour before Madrid moves its clocks forward (01:00 UTC): still +01:00.
    ['2026-03-29T01:30', 'Europe/Madrid', '2026-03-29T01:30:00+01:00'],
  ])('%s in %s is %s, and back', (local, zone, iso) => {
    expect(fromZonedInput(local, zone)).toBe(iso)
    expect(toZonedInput(iso, zone)).toBe(local)
  })

  it('recognises IANA zones', () => {
    expect(isTimeZone('America/Bogota')).toBe(true)
    expect(isTimeZone('Mars/Olympus')).toBe(false)
  })
})

describe('wall time', () => {
  it('splits a value into calendar day and time, and back', () => {
    const parts = parseWallTime('2027-03-05T18:07')
    expect(parts?.date.getDate()).toBe(5)
    expect(parts?.time).toBe('18:07')
    expect(formatWallTime(parts!)).toBe('2027-03-05T18:07')
    expect(parseWallTime('')).toBeNull()
  })
})
