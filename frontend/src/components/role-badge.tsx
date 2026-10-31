import { Badge } from '@/components/ui/badge'
import { es } from '@/i18n/es'
import type { Role } from '@/lib/permissions'
import { cn } from '@/lib/utils'

const styles: Record<Role, string> = {
  ATTENDEE: 'bg-info-soft text-info',
  ORGANIZER: 'bg-warning-soft text-warning',
  ADMIN: 'bg-accent text-accent-foreground',
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge className={cn('border-transparent', styles[role])}>
      {es.roles[role]}
    </Badge>
  )
}
