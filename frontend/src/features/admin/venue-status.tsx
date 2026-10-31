import { CircleCheck, CirclePause } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { es } from '@/i18n/es'
import { cn } from '@/lib/utils'

/** Active / deactivated, with icon and text: never colour alone. */
export function ActiveBadge({ active }: { active: boolean }) {
  const Icon = active ? CircleCheck : CirclePause
  return (
    <Badge
      className={cn(
        'border-transparent',
        active
          ? 'bg-success-soft text-success'
          : 'border-border bg-transparent text-muted-foreground',
      )}
    >
      <Icon aria-hidden />
      {active ? es.venues.active : es.venues.inactive}
    </Badge>
  )
}
