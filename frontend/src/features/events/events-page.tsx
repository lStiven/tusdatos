import { CalendarX2, CloudOff } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback } from 'react'
import { errorMessage } from '@/api/errors'
import { PageHeader } from '@/components/page-header'
import { Pagination } from '@/components/pagination'
import { SearchInput } from '@/components/search-input'
import { StatePanel } from '@/components/state-panel'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCurrentUser } from '@/features/auth/api'
import { es } from '@/i18n/es'
import { hasRole } from '@/lib/permissions'
import { useListParams } from '@/lib/use-list-params'
import { useEvents } from './api'
import { EventCard, EventCardSkeleton } from './event-card'
import type { Event } from './rules'

const PAGE_SIZE = 12
const ALL = 'ALL'
const statuses: Event['status'][] = [
  'PUBLISHED',
  'DRAFT',
  'COMPLETED',
  'CANCELLED',
]

const list = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

export function EventsPage() {
  const { data: user } = useCurrentUser()
  // Filters and page live in the URL: shareable, and "back" restores them.
  const { params, setParams, status, offset, setOffset } =
    useListParams(statuses)
  const title = params.get('q') ?? ''

  const update = useCallback(
    (changes: Record<string, string | null>) =>
      setParams((current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      }),
    [setParams],
  )
  const setTitle = useCallback(
    (value: string) => update({ q: value.trim() || null, desde: null }),
    [update],
  )

  const { data, error, isPending, isError, refetch } = useEvents({
    title: title || undefined,
    status: status ?? undefined,
    limit: PAGE_SIZE,
    offset,
  })

  // Only their owners and admins see drafts: nobody else would find any.
  const canSeeDrafts = !!user && hasRole(user, 'ORGANIZER', 'ADMIN')
  const options = statuses.filter((value) => value !== 'DRAFT' || canSeeDrafts)

  return (
    <>
      <PageHeader title={es.events.title} description={es.events.subtitle} />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={title}
          onChange={setTitle}
          label={es.events.search}
          placeholder={es.events.searchPlaceholder}
        />
        <Select
          value={status ?? ALL}
          onValueChange={(value) =>
            update({ estado: value === ALL ? null : value, desde: null })
          }
        >
          <SelectTrigger
            aria-label={es.events.statusFilter}
            className="w-full sm:w-52"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{es.events.allStatuses}</SelectItem>
            {options.map((value) => (
              <SelectItem key={value} value={value}>
                {es.status.event[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div aria-busy className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <EventCardSkeleton key={index} />
          ))}
        </div>
      ) : isError ? (
        <StatePanel
          icon={CloudOff}
          title={es.events.loadError}
          description={errorMessage(error)}
          action={{ label: es.events.retry, onClick: () => void refetch() }}
          heading="h2"
        />
      ) : data.items.length === 0 ? (
        <StatePanel
          icon={CalendarX2}
          title={es.events.emptyTitle}
          description={es.events.emptyDescription}
          action={
            title || status
              ? {
                  label: es.events.clearFilters,
                  onClick: () => update({ q: null, estado: null, desde: null }),
                }
              : undefined
          }
          heading="h2"
        />
      ) : (
        <>
          <motion.ul
            key={`${title}|${status}|${offset}`}
            className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
            variants={list}
            initial="hidden"
            animate="show"
          >
            {data.items.map((event) => (
              <motion.li key={event.id} variants={item}>
                <EventCard event={event} />
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
