import { CalendarPlus, CloudOff, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { errorMessage } from '@/api/errors'
import { FilterLinks } from '@/components/filter-links'
import { PageHeader } from '@/components/page-header'
import { Pagination } from '@/components/pagination'
import { StatePanel } from '@/components/state-panel'
import { Button } from '@/components/ui/button'
import { EventCard, EventCardSkeleton } from '@/features/events/event-card'
import type { Event } from '@/features/events/rules'
import { es } from '@/i18n/es'
import { useListParams } from '@/lib/use-list-params'
import { useMyEvents } from './api'

const PAGE_SIZE = 12
const statuses: Event['status'][] = [
  'DRAFT',
  'PUBLISHED',
  'COMPLETED',
  'CANCELLED',
]

const list = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

export function MyEventsPage() {
  const { status, offset, setOffset } = useListParams(statuses)
  const { data, error, isPending, isError, refetch } = useMyEvents({
    status: status ?? undefined,
    limit: PAGE_SIZE,
    offset,
  })

  return (
    <>
      <PageHeader
        title={es.myEvents.title}
        description={es.myEvents.subtitle}
        actions={
          <Button asChild>
            <Link to="/organizador/eventos/nuevo">
              <Plus aria-hidden />
              {es.myEvents.create}
            </Link>
          </Button>
        }
      />
      <FilterLinks
        label={es.myEvents.filterLabel}
        current={status}
        options={[
          { value: null, label: es.myEvents.all },
          ...statuses.map((value) => ({
            value,
            label: es.status.event[value],
          })),
        ]}
      />

      {isPending ? (
        <div aria-busy className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <EventCardSkeleton key={index} />
          ))}
        </div>
      ) : isError ? (
        <StatePanel
          icon={CloudOff}
          title={es.myEvents.loadError}
          description={errorMessage(error)}
          action={{ label: es.myEvents.retry, onClick: () => void refetch() }}
          heading="h2"
        />
      ) : data.items.length === 0 ? (
        <StatePanel
          icon={CalendarPlus}
          title={es.myEvents.emptyTitle}
          description={es.myEvents.emptyDescription}
          action={{
            label: es.myEvents.create,
            to: '/organizador/eventos/nuevo',
          }}
          heading="h2"
        />
      ) : (
        <>
          <motion.ul
            key={`${status}|${offset}`}
            className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
            variants={list}
            initial="hidden"
            animate="show"
          >
            {data.items.map((event) => (
              <motion.li key={event.id} variants={item}>
                <EventCard
                  event={event}
                  to={`/organizador/eventos/${event.id}`}
                />
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
