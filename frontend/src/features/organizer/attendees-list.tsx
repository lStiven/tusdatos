import { Hourglass } from 'lucide-react'
import { FilterLinks } from '@/components/filter-links'
import { Pagination } from '@/components/pagination'
import { StatusBadge } from '@/components/status-badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Event, Registration } from '@/features/events/rules'
import { es } from '@/i18n/es'
import { useListParams } from '@/lib/use-list-params'
import { formatDateTime } from '@/lib/dates'
import { useEventRegistrations } from './api'

const PAGE_SIZE = 20
const a = es.attendees
const statuses: Registration['status'][] = [
  'CONFIRMED',
  'WAITLISTED',
  'CANCELLED',
]

/** The event's registrations and its queue, in the order the API gives. */
export function AttendeesList({ event }: { event: Event }) {
  const { status, offset, setOffset } = useListParams(statuses)
  const { data, isPending, isError } = useEventRegistrations(event.id, {
    status: status ?? undefined,
    limit: PAGE_SIZE,
    offset,
  })

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>
          <h2>{a.title}</h2>
        </CardTitle>
        <CardDescription>{a.hint}</CardDescription>
      </CardHeader>
      <CardContent>
        <FilterLinks
          label={a.filterLabel}
          current={status}
          options={[
            { value: null, label: a.all },
            ...statuses.map((value) => ({
              value,
              label: es.myRegistrations.tabs[value],
            })),
          ]}
        />
        {isPending ? (
          <Skeleton className="h-32" />
        ) : isError ? (
          <p className="text-sm text-destructive">{a.loadError}</p>
        ) : data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {status ? a.empty : a.none}
          </p>
        ) : (
          <>
            <ul className="divide-y rounded-xl border">
              {data.items.map((registration) => (
                <li
                  key={registration.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {registration.user.full_name}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {registration.user.email}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {a.requestedAt(
                      formatDateTime(registration.requested_at, event.timezone),
                    )}
                  </p>
                  {registration.waitlist_position && (
                    <span className="flex items-center gap-1 text-sm font-medium text-warning">
                      <Hourglass aria-hidden className="size-3.5" />
                      {a.position(registration.waitlist_position)}
                    </span>
                  )}
                  <StatusBadge
                    kind="registration"
                    status={registration.status}
                  />
                </li>
              ))}
            </ul>
            <Pagination
              total={data.total}
              limit={PAGE_SIZE}
              offset={offset}
              onChange={setOffset}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
