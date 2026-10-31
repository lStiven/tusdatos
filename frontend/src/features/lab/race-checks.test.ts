import { describe, expect, it } from 'vitest'
import type { components } from '@/api/schema'
import {
  clamp,
  lastSeatChecks,
  retriesChecks,
  sameRoomChecks,
  tally,
  type Outcome,
} from './race-checks'

type EventRegistration = components['schemas']['EventRegistrationRead']

const outcome = (status: number, code: string | null = null): Outcome => ({
  status,
  code,
  ms: 10,
})

function registration(
  status: EventRegistration['status'],
  waitlist_position: number | null = null,
): EventRegistration {
  return {
    id: Math.random(),
    event_id: 1,
    status,
    waitlist_position,
    requested_at: '2027-01-01T00:00:00Z',
    confirmed_at: null,
    cancelled_at: null,
    user: { id: 1, email: 'lab@lab.example.com', full_name: 'Lab' },
  }
}

const verdicts = (checks: { ok: boolean }[]) => checks.map((check) => check.ok)

describe('race checks', () => {
  it('accepts a full event with a contiguous queue, 503s included', () => {
    const outcomes = [...Array(4).fill(outcome(201)), outcome(503)]
    const registrations = [
      registration('CONFIRMED'),
      registration('CONFIRMED'),
      registration('WAITLISTED', 1),
      registration('WAITLISTED', 2),
    ]
    expect(verdicts(lastSeatChecks(2, outcomes, registrations))).toEqual([
      true,
      true,
      true,
      true,
      true,
    ])
  })

  it('flags an oversold event, a queue with gaps and unexpected answers', () => {
    const outcomes = [outcome(201), outcome(201), outcome(201), outcome(500)]
    const registrations = [
      registration('CONFIRMED'),
      registration('CONFIRMED'),
      registration('WAITLISTED', 2),
    ]
    expect(verdicts(lastSeatChecks(1, outcomes, registrations))).toEqual([
      false,
      false,
      false,
      true,
      false,
    ])
  })

  it.each([
    [
      'one created, the rest the same',
      [201, 200, 200, 503],
      1,
      [true, true, true],
    ],
    ['duplicated', [201, 201], 2, [false, false, true]],
  ])('retries: %s', (_, statuses, registrations, expected) => {
    expect(
      verdicts(
        retriesChecks(
          statuses.map((status) => outcome(status)),
          registrations,
        ),
      ),
    ).toEqual(expected)
  })

  it.each([
    [
      'one booking, the rest rejected',
      [outcome(200), outcome(409, 'room_not_available'), outcome(503)],
      1,
      [true, true],
    ],
    ['double booking', [outcome(200), outcome(200)], 2, [false, true]],
  ])('same room: %s', (_, outcomes, scheduled, expected) => {
    expect(verdicts(sameRoomChecks(outcomes, scheduled))).toEqual(expected)
  })

  it('tallies answers by status and code', () => {
    expect(
      tally([
        outcome(409, 'room_not_available'),
        outcome(200),
        outcome(409, 'room_not_available'),
      ]),
    ).toEqual([
      ['200', 1],
      ['409 room_not_available', 2],
    ])
  })

  it.each([
    ['20', 20],
    ['1', 2],
    ['500', 50],
    ['abc', 2],
    ['7.9', 7],
  ])('clamps %s to %s', (value, expected) => {
    expect(clamp(value, 2, 50)).toBe(expected)
  })
})
