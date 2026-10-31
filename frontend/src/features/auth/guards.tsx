import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { ShieldX } from 'lucide-react'
import { hasRole, type Role } from '@/lib/permissions'
import { es } from '@/i18n/es'
import { StatePanel } from '@/components/state-panel'
import { usePageTitle } from '@/lib/use-page-title'
import { useCurrentUser } from './api'
import { useToken } from './session'

/** Sends anonymous visitors to the login, remembering where they were going. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useToken()
  const location = useLocation()
  if (token === null) {
    const next = location.pathname + location.search
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  return children
}

function Forbidden({ roles }: { roles: Role[] }) {
  usePageTitle(es.forbidden.title)
  return (
    <StatePanel
      icon={ShieldX}
      title={es.forbidden.title}
      description={es.forbidden.description(
        roles.map((role) => es.roles[role]).join(' o '),
      )}
      action={{ label: es.forbidden.back, to: '/' }}
    />
  )
}

/** Shows a 403 page instead of the content if the user has none of the roles. */
export function RequireRole({
  roles,
  children,
}: {
  roles: Role[]
  children: ReactNode
}) {
  const { data: user } = useCurrentUser()
  if (user && !hasRole(user, ...roles)) return <Forbidden roles={roles} />
  return children
}
