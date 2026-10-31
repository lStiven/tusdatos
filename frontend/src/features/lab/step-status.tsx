import {
  Circle,
  CircleCheck,
  CircleMinus,
  CircleX,
  LoaderCircle,
  type LucideIcon,
} from 'lucide-react'
import { es } from '@/i18n/es'
import { cn } from '@/lib/utils'
import type { StepStatus } from './runner'

const looks: Record<StepStatus, [LucideIcon, string]> = {
  idle: [Circle, 'text-muted-foreground'],
  running: [LoaderCircle, 'animate-spin text-primary'],
  pass: [CircleCheck, 'text-success'],
  fail: [CircleX, 'text-danger'],
  skipped: [CircleMinus, 'text-muted-foreground'],
}

/** Icon plus a text for screen readers: never colour alone. */
export function StepStatusIcon({ status }: { status: StepStatus }) {
  const [Icon, tone] = looks[status]
  return (
    <span className="inline-flex" title={es.lab.stepStatus[status]}>
      <Icon aria-hidden className={cn('size-5', tone)} />
      <span className="sr-only">{es.lab.stepStatus[status]}</span>
    </span>
  )
}
