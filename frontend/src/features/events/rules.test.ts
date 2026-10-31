import { describe, expect, it } from 'vitest'
import {
  daysFromNow,
  makeEvent,
  makeRegistration,
  makeSession,
} from '@/test/fixtures'
import {
  canCancel,
  interestBlock,
  overlapping,
  registrationBlock,
} from './rules'

describe('registrationBlock', () => {
  it.each([
    ['open', makeEvent(), null],
    ['not published', makeEvent({ status: 'DRAFT' }), 'DRAFT'],
    ['cancelled', makeEvent({ status: 'CANCELLED' }), 'CANCELLED'],
    [
      'past its closing date, before starting',
      makeEvent({ registration_closes_at: daysFromNow(-1) }),
      'closed',
    ],
    [
      'started, without a closing date',
      makeEvent({ starts_at: daysFromNow(-0.1) }),
      'closed',
    ],
  ])('%s → %s', (_, event, expected) => {
    expect(registrationBlock(event)).toBe(expected)
  })
})

describe('canCancel', () => {
  it.each([
    ['confirmed, before the start', 'CONFIRMED', daysFromNow(1), true],
    [
      'waitlisted, after registration closed',
      'WAITLISTED',
      daysFromNow(1),
      true,
    ],
    ['already cancelled', 'CANCELLED', daysFromNow(1), false],
    ['after the start', 'CONFIRMED', daysFromNow(-0.1), false],
  ] as const)('%s → %s', (_, status, startsAt, expected) => {
    expect(
      canCancel({ starts_at: startsAt }, makeRegistration({ status })),
    ).toBe(expected)
  })

  it('needs a registration', () => {
    expect(canCancel(makeEvent(), null)).toBe(false)
  })
})

describe('interestBlock', () => {
  const confirmed = makeRegistration()

  it.each([
    ['open and confirmed', makeSession(), confirmed, null],
    [
      'waitlisted',
      makeSession(),
      makeRegistration({ status: 'WAITLISTED' }),
      'notConfirmed',
    ],
    ['not registered', makeSession(), null, 'notConfirmed'],
    ['draft session', makeSession({ status: 'DRAFT' }), confirmed, 'notOpen'],
    [
      'started session',
      makeSession({ starts_at: daysFromNow(-0.01) }),
      confirmed,
      'notOpen',
    ],
  ])('%s → %s', (_, session, registration, expected) => {
    expect(interestBlock(session, registration)).toBe(expected)
  })
})

describe('overlapping', () => {
  it('returns only other interesting, active sessions that share time', () => {
    const at = (hours: number) =>
      `2026-11-28T${String(hours).padStart(2, '0')}:00:00Z`
    const target = makeSession({ id: 1, starts_at: at(10), ends_at: at(12) })
    const overlaps = makeSession({
      id: 2,
      starts_at: at(11),
      ends_at: at(13),
      is_interested: true,
    })
    const sessions = [
      target,
      overlaps,
      // Back to back is not an overlap.
      makeSession({
        id: 3,
        starts_at: at(12),
        ends_at: at(13),
        is_interested: true,
      }),
      makeSession({
        id: 4,
        starts_at: at(10),
        ends_at: at(11),
        is_interested: false,
      }),
      makeSession({
        id: 5,
        starts_at: at(10),
        ends_at: at(11),
        is_interested: true,
        status: 'CANCELLED',
      }),
    ]
    expect(overlapping(target, sessions)).toEqual([overlaps])
  })
})
