import type { components } from '@/api/schema'

export type User = components['schemas']['UserRead']
export type Role = components['schemas']['RoleCode']

export type Action =
  | 'event:create'
  | 'event:manage'
  | 'registration:list'
  | 'speaker:manage'
  | 'venue:manage'
  | 'user:manage'

export function hasRole(user: User, ...roles: Role[]): boolean {
  return roles.some((role) => user.roles.includes(role))
}

/**
 * Mirrors the authorization table of docs/01 §3 to adapt the UI. The API decides:
 * a hidden button is a convenience, never the protection.
 */
export function can(
  user: User,
  action: Action,
  event?: { owner_id: number },
): boolean {
  if (hasRole(user, 'ADMIN')) return true
  switch (action) {
    case 'event:create':
    case 'speaker:manage':
      return hasRole(user, 'ORGANIZER')
    case 'event:manage':
    case 'registration:list':
      // Ownership alone is not enough: an owner who lost ORGANIZER cannot edit.
      return hasRole(user, 'ORGANIZER') && event?.owner_id === user.id
    case 'venue:manage':
    case 'user:manage':
      return false
  }
}
