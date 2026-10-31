import { ArrowLeft, CalendarX2, Eye, ShieldX } from 'lucide-react'
import { motion } from 'motion/react'
import { Link, useParams } from 'react-router'
import { errorMessage } from '@/api/errors'
import { PageHeader } from '@/components/page-header'
import { StatePanel } from '@/components/state-panel'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/auth/api'
import { useEvent, useOccupancy } from '@/features/events/api'
import { OccupancyMeter } from '@/features/events/occupancy-meter'
import type { Event } from '@/features/events/rules'
import { es } from '@/i18n/es'
import { formatRange } from '@/lib/dates'
import { can } from '@/lib/permissions'
import { AttendeesList } from './attendees-list'
import { EventActions } from './event-actions'
import { SessionsManager } from './sessions-manager'

const m = es.manage

export function ManageEventPage() {
  const id = Number(useParams().eventId)
  const { data: user } = useCurrentUser()
  const { data: event, error, isPending } = useEvent(id)

  if (isPending || !user) {
    return (
      <div aria-busy className="space-y-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    )
  }
  if (error) {
    return (
      <StatePanel
        icon={CalendarX2}
        title={es.eventDetail.notFoundTitle}
        description={errorMessage(error)}
        action={{ label: m.back, to: '/organizador/eventos' }}
      />
    )
  }
  // The API would answer 403 to every change: say so before the user tries.
  if (!can(user, 'event:manage', event)) {
    return (
      <StatePanel
        icon={ShieldX}
        title={m.forbiddenTitle}
        description={m.forbiddenDescription}
        action={{ label: m.viewAsAttendee, to: `/eventos/${event.id}` }}
      />
    )
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/organizador/eventos">
          <ArrowLeft aria-hidden />
          {m.back}
        </Link>
      </Button>
      <PageHeader
        title={event.title}
        description={formatRange(
          event.starts_at,
          event.ends_at,
          event.timezone,
        )}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge kind="event" status={event.status} />
            <Button asChild variant="ghost" size="sm">
              <Link to={`/eventos/${event.id}`}>
                <Eye aria-hidden />
                {m.viewAsAttendee}
              </Link>
            </Button>
          </div>
        }
      />
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <EventActions event={event} />
        <Stats event={event} />
        <SessionsManager event={event} />
        <AttendeesList event={event} />
      </motion.div>
    </>
  )
}

function Stats({ event }: { event: Event }) {
  const { data } = useOccupancy(event.id)
  if (!data) return <Skeleton className="h-28" />
  const stats = [
    [m.stats.confirmed, data.confirmed],
    [m.stats.available, data.available],
    [m.stats.waitlisted, data.waitlisted],
    [m.stats.occupancy, `${data.occupancy_percent} %`],
  ] as const
  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="font-heading text-2xl font-semibold tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <OccupancyMeter occupancy={data} />
      </CardContent>
    </Card>
  )
}
