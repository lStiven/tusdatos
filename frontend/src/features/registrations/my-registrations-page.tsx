import { ChevronRight, CloudOff, Hourglass, TicketX } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { errorMessage } from '@/api/errors'
import { FilterLinks } from '@/components/filter-links'
import { PageHeader } from '@/components/page-header'
import { Pagination } from '@/components/pagination'
import { StatePanel } from '@/components/state-panel'
import { StatusBadge } from '@/components/status-badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Registration } from '@/features/events/rules'
import { es } from '@/i18n/es'
import { formatDateTime } from '@/lib/dates'
import { useListParams } from '@/lib/use-list-params'
import { useMyRegistrations } from './api'

const PAGE_SIZE = 10
const statuses = ['CONFIRMED', 'WAITLISTED', 'CANCELLED'] as const

const list = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

export function MyRegistrationsPage() {
  const { status, offset, setOffset } = useListParams(statuses)

  const { data, error, isPending, isError, refetch } = useMyRegistrations({
    status: status ?? undefined,
    limit: PAGE_SIZE,
    offset,
  })

  return (
    <>
      <PageHeader
        title={es.myRegistrations.title}
        description={es.myRegistrations.subtitle}
      />
      <FilterLinks
        label={es.myRegistrations.filterLabel}
        current={status}
        options={[
          { value: null, label: es.myRegistrations.tabs.ALL },
          ...statuses.map((value) => ({
            value,
            label: es.myRegistrations.tabs[value],
          })),
        ]}
      />

      {isPending ? (
        <div aria-busy className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <StatePanel
          icon={CloudOff}
          title={es.myRegistrations.loadError}
          description={errorMessage(error)}
          action={{
            label: es.myRegistrations.retry,
            onClick: () => void refetch(),
          }}
          heading="h2"
        />
      ) : data.items.length === 0 ? (
        <StatePanel
          icon={TicketX}
          title={es.myRegistrations.emptyTitle}
          description={es.myRegistrations.emptyDescription}
          action={{ label: es.myRegistrations.explore, to: '/eventos' }}
          heading="h2"
        />
      ) : (
        <>
          <motion.ul
            key={`${status}|${offset}`}
            className="space-y-3"
            variants={list}
            initial="hidden"
            animate="show"
          >
            {data.items.map((registration) => (
              <motion.li key={registration.id} variants={item}>
                <RegistrationCard registration={registration} />
              </motion.li>
            ))}
          </motion.ul>
          <Pagination
            total={data.total}
            limit={PAGE_SIZE}
            offset={offset}
            onChange={setOffset}
          />
        </>
      )}
    </>
  )
}

function RegistrationCard({ registration }: { registration: Registration }) {
  const { event } = registration
  return (
    <Card className="group relative flex-row items-center gap-4 p-4 shadow-sm transition-all duration-300 focus-within:ring-2 focus-within:ring-ring hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
      <div className="min-w-0 flex-1 space-y-2">
        <h2 className="font-heading font-semibold">
          <Link
            to={`/eventos/${event.id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-xl group-hover:text-primary"
          >
            {event.title}
          </Link>
        </h2>
        <p className="text-sm text-muted-foreground">
          {formatDateTime(event.starts_at, event.timezone)} · {event.timezone}
        </p>
        {/* Two statuses: a cancelled event leaves the registration cancelled too. */}
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground">
              {es.myRegistrations.registrationStatus}
            </dt>
            <dd>
              <StatusBadge kind="registration" status={registration.status} />
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground">
              {es.myRegistrations.eventStatus}
            </dt>
            <dd>
              <StatusBadge kind="event" status={event.status} />
            </dd>
          </div>
        </dl>
        {registration.status === 'WAITLISTED' &&
          registration.waitlist_position && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
              <Hourglass aria-hidden className="size-3.5" />
              {es.myRegistrations.position(registration.waitlist_position)}
            </p>
          )}
      </div>
      <ChevronRight
        aria-hidden
        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Card>
  )
}
