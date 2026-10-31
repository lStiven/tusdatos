import {
  Building2,
  CalendarDays,
  CalendarCog,
  FlaskConical,
  House,
  Mic,
  Ticket,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { es } from '@/i18n/es'
import { hasRole, type Role, type User } from '@/lib/permissions'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

interface NavSection {
  label: string
  items: NavItem[]
  /** Visible if the user has any of these roles; everyone if omitted. */
  roles?: Role[]
  labOnly?: boolean
}

const sections: NavSection[] = [
  {
    label: es.nav.explore,
    items: [
      { to: '/', label: es.nav.home, icon: House },
      { to: '/eventos', label: es.nav.events, icon: CalendarDays },
      { to: '/mis-inscripciones', label: es.nav.myRegistrations, icon: Ticket },
    ],
  },
  {
    label: es.nav.organize,
    roles: ['ORGANIZER', 'ADMIN'],
    items: [
      { to: '/organizador/eventos', label: es.nav.myEvents, icon: CalendarCog },
      { to: '/ponentes', label: es.nav.speakers, icon: Mic },
    ],
  },
  {
    label: es.nav.administer,
    roles: ['ADMIN'],
    items: [
      { to: '/admin/sedes', label: es.nav.venues, icon: Building2 },
      { to: '/admin/usuarios', label: es.nav.users, icon: UsersRound },
    ],
  },
  {
    label: es.nav.tools,
    labOnly: true,
    items: [{ to: '/laboratorio', label: es.nav.lab, icon: FlaskConical }],
  },
]

export function navFor(user: User, withLab: boolean) {
  return sections.filter(
    (section) =>
      (!section.roles || hasRole(user, ...section.roles)) &&
      (!section.labOnly || withLab),
  )
}
