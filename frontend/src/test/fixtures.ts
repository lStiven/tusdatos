import type { components } from '@/api/schema'
import { http, HttpResponse } from 'msw'
import type { User } from '@/lib/permissions'

export const attendee: User = {
  id: 1,
  email: 'carla@demo.example.com',
  full_name: 'Carla Peña',
  is_active: true,
  roles: ['ATTENDEE'],
}
export const organizer: User = {
  ...attendee,
  id: 2,
  email: 'ana@demo.example.com',
  full_name: 'Ana Gómez',
  roles: ['ATTENDEE', 'ORGANIZER'],
}
export const admin: User = {
  ...attendee,
  id: 3,
  email: 'admin@demo.example.com',
  full_name: 'Admin Demo',
  roles: ['ATTENDEE', 'ADMIN'],
}

export function apiError(status: number, code: string, message = code) {
  return HttpResponse.json({ code, message, details: null }, { status })
}

export const handlers = {
  me: (user: User) =>
    http.get('/api/v1/users/me', () => HttpResponse.json(user)),
  health: () =>
    http.get('/health', () =>
      HttpResponse.json({ status: 'ok', checks: { database: true } }),
    ),
  token: () =>
    http.post('/api/v1/auth/token', () =>
      HttpResponse.json({
        access_token: 'jwt',
        token_type: 'bearer',
        expires_in: 1800,
      }),
    ),
}

type Schemas = components['schemas']

const DAY = 86_400_000
/** ISO date `days` from now (negative: in the past). */
export const daysFromNow = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString()

export function makeEvent(
  overrides: Partial<Schemas['EventRead']> = {},
): Schemas['EventRead'] {
  return {
    id: 1,
    owner_id: organizer.id,
    venue_id: null,
    title: 'PyData Bogotá',
    description: 'Data science day.',
    capacity: 3,
    status: 'PUBLISHED',
    starts_at: daysFromNow(10),
    ends_at: daysFromNow(10.4),
    registration_closes_at: null,
    timezone: 'America/Bogota',
    ...overrides,
  }
}

export function makeRegistration(
  overrides: Partial<Schemas['RegistrationRead']> = {},
): Schemas['RegistrationRead'] {
  const event = makeEvent()
  return {
    id: 1,
    event_id: event.id,
    status: 'CONFIRMED',
    waitlist_position: null,
    requested_at: daysFromNow(-1),
    confirmed_at: daysFromNow(-1),
    cancelled_at: null,
    event: {
      id: event.id,
      title: event.title,
      status: event.status,
      starts_at: event.starts_at,
      timezone: event.timezone,
    },
    ...overrides,
  }
}

export function makeSession(
  overrides: Partial<Schemas['SessionRead']> = {},
): Schemas['SessionRead'] {
  return {
    id: 1,
    event_id: 1,
    title: 'Keynote',
    description: null,
    capacity: 50,
    status: 'SCHEDULED',
    starts_at: daysFromNow(10),
    ends_at: daysFromNow(10.05),
    room: { id: 1, name: 'Main Auditorium', capacity: 150 },
    speakers: [],
    interested: 0,
    interest_percent: 0,
    overdemand: false,
    is_interested: false,
    ...overrides,
  }
}

export function makeOccupancy(
  overrides: Partial<Schemas['Occupancy']> = {},
): Schemas['Occupancy'] {
  return {
    event_id: 1,
    capacity: 3,
    confirmed: 1,
    available: 2,
    waitlisted: 0,
    occupancy_percent: 33,
    ...overrides,
  }
}

export function page<T>(
  items: T[],
  { total = items.length, limit = 12, offset = 0 } = {},
) {
  return { items, total, limit, offset }
}

export function makeVenue(
  overrides: Partial<Schemas['VenueRead']> = {},
): Schemas['VenueRead'] {
  return {
    id: 4,
    name: 'Ágora',
    address: null,
    city: 'Bogotá',
    is_active: true,
    ...overrides,
  }
}

export function makeRoom(
  overrides: Partial<Schemas['RoomRead']> = {},
): Schemas['RoomRead'] {
  return {
    id: 7,
    venue_id: 4,
    name: 'Main Auditorium',
    capacity: 150,
    is_active: true,
    ...overrides,
  }
}

export function makeSpeaker(
  overrides: Partial<Schemas['SpeakerRead']> = {},
): Schemas['SpeakerRead'] {
  return {
    id: 1,
    full_name: 'Lucía Fernández',
    email: null,
    bio: null,
    ...overrides,
  }
}
