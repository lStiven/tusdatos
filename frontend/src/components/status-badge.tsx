import {
  CalendarCheck,
  CircleCheck,
  CircleX,
  Flag,
  Hourglass,
  PencilLine,
  type LucideIcon,
} from 'lucide-react'
import type { components } from '@/api/schema'
import { Badge } from '@/components/ui/badge'
import { es } from '@/i18n/es'
import { cn } from '@/lib/utils'

type Schemas = components['schemas']

type Kind = {
  event: Schemas['EventStatus']
  registration: Schemas['RegistrationStatus']
  session: Schemas['SessionStatus']
}

type Status = Kind[keyof Kind]

const tones = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
} as const

// Icon and text always go with the colour: status never relies on colour alone.
const looks: Record<Status, [keyof typeof tones, LucideIcon]> = {
  PUBLISHED: ['success', CalendarCheck],
  SCHEDULED: ['success', CalendarCheck],
  CONFIRMED: ['success', CircleCheck],
  DRAFT: ['warning', PencilLine],
  WAITLISTED: ['warning', Hourglass],
  CANCELLED: ['danger', CircleX],
  COMPLETED: ['info', Flag],
}

export function StatusBadge<K extends keyof Kind>({
  kind,
  status,
  className,
}: {
  kind: K
  status: Kind[K]
  className?: string
}) {
  const [tone, Icon] = looks[status]
  const labels = es.status[kind] as Record<Kind[K], string>
  return (
    <Badge className={cn('border-transparent', tones[tone], className)}>
      <Icon aria-hidden />
      {labels[status]}
    </Badge>
  )
}
