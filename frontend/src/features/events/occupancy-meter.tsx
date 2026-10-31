import { motion } from 'motion/react'
import type { components } from '@/api/schema'
import { es } from '@/i18n/es'
import { cn } from '@/lib/utils'

type Occupancy = components['schemas']['Occupancy']

function barTone(percent: number) {
  if (percent >= 100) return 'bg-destructive'
  if (percent >= 80) return 'bg-warning'
  return 'bg-primary'
}

/** Seats taken out of the capacity, plus the waitlist size. */
export function OccupancyMeter({
  occupancy,
  className,
}: {
  occupancy: Occupancy
  className?: string
}) {
  const {
    capacity,
    confirmed,
    waitlisted,
    occupancy_percent: percent,
  } = occupancy
  const full = confirmed >= capacity
  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Decorative: the text below says the same to everyone. */}
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn('h-full rounded-full', barTone(percent))}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percent, 100)}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <p className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
        <span>
          {full ? (
            <span className="font-medium text-danger">
              {es.occupancy.full} ·{' '}
            </span>
          ) : null}
          {es.occupancy.summary(confirmed, capacity)}
        </span>
        {waitlisted > 0 && <span>{es.occupancy.waitlisted(waitlisted)}</span>}
      </p>
    </div>
  )
}
