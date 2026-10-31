import { describe, expect, it } from 'vitest'
import { daysFromNow, makeEvent, makeSession } from '@/test/fixtures'
import { completeBlock, isEditable, publishBlock, scheduleBlock } from './rules'

describe('organizer rules', () => {
  it.each([
    ['DRAFT', true],
    ['PUBLISHED', true],
    ['CANCELLED', false],
    ['COMPLETED', false],
  ] as const)('a %s event is editable: %s', (status, expected) => {
    expect(isEditable({ status })).toBe(expected)
  })

  it.each([
    ['ready', makeEvent({ venue_id: 4 }), null],
    ['without venue', makeEvent({ venue_id: null }), 'noVenue'],
    [
      'already started',
      makeEvent({ venue_id: 4, starts_at: daysFromNow(-0.1) }),
      'started',
    ],
  ])('publishing an event %s → %s', (_, event, expected) => {
    expect(publishBlock(event)).toBe(expected)
  })

  it.each([
    ['before it ends', daysFromNow(1), 'notEnded'],
    ['after it ends', daysFromNow(-1), null],
  ])('completing %s → %s', (_, endsAt, expected) => {
    expect(completeBlock({ ends_at: endsAt })).toBe(expected)
  })

  it.each([
    ['with a big enough room', makeSession({ capacity: 150 }), null],
    ['without room', makeSession({ room: null }), 'needsRoom'],
    ['in a small room', makeSession({ capacity: 151 }), 'roomTooSmall'],
  ])('scheduling a session %s → %s', (_, session, expected) => {
    expect(scheduleBlock(session)).toBe(expected)
  })
})
