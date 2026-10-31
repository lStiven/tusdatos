import { Clock, Globe } from 'lucide-react'
import { Link } from 'react-router'
import { StatusBadge } from '@/components/status-badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { dateTile, formatRange } from '@/lib/dates'
import { useOccupancy } from './api'
import { OccupancyMeter } from './occupancy-meter'
import type { Event } from './rules'

export function EventCard({ event }: { event: Event }) {
  // Seats only matter while registrations can happen.
  const { data: occupancy } = useOccupancy(
    event.id,
    event.status === 'PUBLISHED',
  )
  const tile = dateTile(event.starts_at, event.timezone)

  return (
    <Card className="group relative h-full gap-4 p-5 shadow-sm transition-all duration-300 focus-within:ring-2 focus-within:ring-ring hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-start gap-4">
        <div
          aria-hidden
          className="grid w-14 shrink-0 place-items-center rounded-xl border bg-accent/60 py-2 text-accent-foreground"
        >
          <span className="text-xs font-medium uppercase">{tile.month}</span>
          <span className="font-heading text-2xl leading-none font-semibold">
            {tile.day}
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <StatusBadge kind="event" status={event.status} />
          <h2 className="font-heading leading-snug font-semibold">
            {/* The link covers the whole card; the rest stays plain text. */}
            <Link
              to={`/eventos/${event.id}`}
              className="outline-none after:absolute after:inset-0 after:rounded-xl group-hover:text-primary"
            >
              {event.title}
            </Link>
          </h2>
        </div>
      </div>
      <ul className="space-y-1 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <Clock aria-hidden className="size-4 shrink-0" />
          {formatRange(event.starts_at, event.ends_at, event.timezone)}
        </li>
        <li className="flex items-center gap-2">
          <Globe aria-hidden className="size-4 shrink-0" />
          {event.timezone}
        </li>
      </ul>
      {event.status === 'PUBLISHED' &&
        (occupancy ? (
          <OccupancyMeter occupancy={occupancy} className="mt-auto" />
        ) : (
          <Skeleton className="mt-auto h-6" />
        ))}
    </Card>
  )
}

export function EventCardSkeleton() {
  return (
    <Card className="gap-4 p-5">
      <div className="flex gap-4">
        <Skeleton className="h-16 w-14 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      </div>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-6" />
    </Card>
  )
}
