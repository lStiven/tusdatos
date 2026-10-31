import { describe, expect, it } from 'vitest'
import { admin, attendee, organizer } from '@/test/fixtures'
import { can, type Action } from './permissions'

const own = { owner_id: organizer.id }
const other = { owner_id: 999 }
const formerOrganizer = { ...attendee, id: 50 }

describe('can', () => {
  it.each<
    [
      string,
      Parameters<typeof can>[0],
      Action,
      { owner_id: number } | undefined,
      boolean,
    ]
  >([
    ['attendee creates an event', attendee, 'event:create', undefined, false],
    ['organizer creates an event', organizer, 'event:create', undefined, true],
    ['organizer edits own event', organizer, 'event:manage', own, true],
    ['organizer edits another event', organizer, 'event:manage', other, false],
    [
      'owner without ORGANIZER edits',
      formerOrganizer,
      'event:manage',
      { owner_id: 50 },
      false,
    ],
    [
      'organizer lists own registrations',
      organizer,
      'registration:list',
      own,
      true,
    ],
    [
      'organizer manages speakers',
      organizer,
      'speaker:manage',
      undefined,
      true,
    ],
    ['organizer manages venues', organizer, 'venue:manage', undefined, false],
    ['organizer grants roles', organizer, 'user:manage', undefined, false],
    ['admin edits any event', admin, 'event:manage', other, true],
    ['admin grants roles', admin, 'user:manage', undefined, true],
  ])('%s → %s', (_, user, action, event, expected) => {
    expect(can(user, action, event)).toBe(expected)
  })
})
