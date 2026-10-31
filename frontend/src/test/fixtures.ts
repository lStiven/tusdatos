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
