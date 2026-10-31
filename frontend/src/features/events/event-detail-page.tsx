import {
  ArrowLeft,
  CalendarClock,
  CalendarX2,
  CloudOff,
  Globe,
  MapPin,
  Settings2,
} from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { errorMessage } from '@/api/errors'
import { PageHeader } from '@/components/page-header'
import { StatePanel } from '@/components/state-panel'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/auth/api'
import { es } from '@/i18n/es'
import { can } from '@/lib/permissions'
import { formatDateTime, formatRange } from '@/lib/dates'
import {
  useEvent,
  useMyRegistration,
  useOccupancy,
  useSessions,
  useVenue,
} from './api'
import { Agenda } from './agenda'
import { OccupancyMeter } from './occupancy-meter'
import { RegistrationPanel } from './registration-panel'
import type { Event } from './rules'

function NotFound() {
  return (
    <StatePanel
      icon={CalendarX2}
      title={es.eventDetail.notFoundTitle}
      description={es.eventDetail.notFoundDescription}
      action={{ label: es.eventDetail.back, to: '/eventos' }}
    />
  )
}

export function EventDetailPage() {
  const id = Number(useParams().eventId)
  if (!Number.isInteger(id) || id <= 0) return <NotFound />
  return <EventDetail key={id} id={id} />
}

function EventDetail({ id }: { id: number }) {
  const { data: user } = useCurrentUser()
  const { data: event, error, isPending, refetch } = useEvent(id)

  if (isPending) return <DetailSkeleton />
  // A draft of someone else is a 404 too: the API does not reveal it exists.
  if (error?.code === 'event_not_found') return <NotFound />
  if (error) {
    return (
      <StatePanel
        icon={CloudOff}
        title={es.eventDetail.loadError}
        description={errorMessage(error)}
        action={{ label: es.eventDetail.retry, onClick: () => void refetch() }}
      />
    )
  }

  return (
    <>
      <BackLink />
      <PageHeader
        title={event.title}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge kind="event" status={event.status} />
            {user && can(user, 'event:manage', event) && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/organizador/eventos/${event.id}`}>
                  <Settings2 aria-hidden />
                  {es.manage.manage}
                </Link>
              </Button>
            )}
          </div>
        }
      />
      <EventFacts event={event} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>
                <h2>{es.eventDetail.about}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-muted-foreground">
                {event.description ?? es.eventDetail.noDescription}
              </p>
            </CardContent>
          </Card>
          <AgendaCard event={event} />
        </motion.div>
        <motion.aside
          className="space-y-6 max-lg:order-first lg:sticky lg:top-20"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <RegistrationCard event={event} />
        </motion.aside>
      </div>
    </>
  )
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
      <Link to="/eventos">
        <ArrowLeft aria-hidden />
        {es.eventDetail.back}
      </Link>
    </Button>
  )
}

function Fact({
  icon: Icon,
  children,
}: {
  icon: typeof Globe
  children: ReactNode
}) {
  return (
    <li className="flex items-start gap-2">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  )
}

function EventFacts({ event }: { event: Event }) {
  const { data: venue } = useVenue(event.venue_id)
  const venueText = event.venue_id
    ? venue
      ? [venue.name, venue.city].filter(Boolean).join(' · ')
      : '…'
    : es.eventDetail.noVenue
  return (
    <ul className="mb-6 grid gap-3 rounded-xl border bg-card/60 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <Fact icon={CalendarClock}>
        {formatRange(event.starts_at, event.ends_at, event.timezone)}
      </Fact>
      <Fact icon={MapPin}>{venueText}</Fact>
      <Fact icon={Globe}>{es.eventDetail.timezone(event.timezone)}</Fact>
      {event.registration_closes_at && (
        <Fact icon={CalendarX2}>
          {es.eventDetail.registrationCloses(
            formatDateTime(event.registration_closes_at, event.timezone),
          )}
        </Fact>
      )}
    </ul>
  )
}

function RegistrationCard({ event }: { event: Event }) {
  const registration = useMyRegistration(event.id)
  const occupancy = useOccupancy(event.id)
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>
          <h2>{es.registration.title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {registration.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-10" />
          </div>
        ) : registration.isError ? (
          <p className="text-sm text-destructive">
            {errorMessage(registration.error)}
          </p>
        ) : (
          <RegistrationPanel event={event} registration={registration.data} />
        )}
        {occupancy.data && (
          <div className="space-y-2 border-t pt-4">
            <OccupancyMeter occupancy={occupancy.data} />
            <p className="text-xs text-muted-foreground">
              {es.occupancy.snapshot}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AgendaCard({ event }: { event: Event }) {
  const sessions = useSessions(event.id)
  const registration = useMyRegistration(event.id)
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>
          <h2>{es.agenda.title}</h2>
        </CardTitle>
        <CardDescription>{es.agenda.hint}</CardDescription>
      </CardHeader>
      <CardContent>
        {sessions.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : sessions.isError ? (
          <p className="text-sm text-destructive">{es.agenda.loadError}</p>
        ) : (
          <Agenda
            event={event}
            sessions={sessions.data}
            registration={registration.data ?? null}
          />
        )}
      </CardContent>
    </Card>
  )
}

function DetailSkeleton() {
  return (
    <div aria-busy className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-10 w-2/3" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-56" />
      </div>
    </div>
  )
}
