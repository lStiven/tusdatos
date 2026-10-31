import { Building2, ChevronRight, CloudOff, MapPin, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '@/api/errors'
import { FilterLinks } from '@/components/filter-links'
import { PageHeader } from '@/components/page-header'
import { StatePanel } from '@/components/state-panel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { es } from '@/i18n/es'
import { useListParams } from '@/lib/use-list-params'
import { useVenues } from './api'
import { VenueDialog } from './venue-dialogs'
import { ActiveBadge } from './venue-status'

const t = es.venues
const filters = ['ACTIVE', 'INACTIVE'] as const
const list = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

export function VenuesPage() {
  const { status } = useListParams(filters)
  const { data, error, isPending, isError, refetch } = useVenues(
    status === null ? undefined : status === 'ACTIVE',
  )
  const [creating, setCreating] = useState(false)

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.subtitle}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            {t.create}
          </Button>
        }
      />
      <FilterLinks
        label={t.filterLabel}
        current={status}
        options={[
          { value: null, label: t.filters.ALL },
          ...filters.map((value) => ({ value, label: t.filters[value] })),
        ]}
      />

      {isPending ? (
        <div aria-busy className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : isError ? (
        <StatePanel
          icon={CloudOff}
          title={t.loadError}
          description={errorMessage(error)}
          action={{ label: t.retry, onClick: () => void refetch() }}
          heading="h2"
        />
      ) : data.length === 0 ? (
        <StatePanel
          icon={Building2}
          title={t.emptyTitle}
          description={t.emptyDescription}
          heading="h2"
        />
      ) : (
        <motion.ul
          key={status ?? 'all'}
          className="grid gap-4 md:grid-cols-2"
          variants={list}
          initial="hidden"
          animate="show"
        >
          {data.map((venue) => (
            <motion.li key={venue.id} variants={item}>
              <Card className="group relative h-full flex-row items-center gap-4 p-5 shadow-sm transition-all duration-300 focus-within:ring-2 focus-within:ring-ring hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <Building2 aria-hidden className="size-5" />
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <h2 className="font-heading font-semibold">
                    <Link
                      to={`/admin/sedes/${venue.id}`}
                      className="outline-none after:absolute after:inset-0 after:rounded-xl group-hover:text-primary"
                    >
                      {venue.name}
                    </Link>
                  </h2>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin aria-hidden className="size-3.5 shrink-0" />
                    {[venue.city ?? t.noCity, venue.address]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <ActiveBadge active={venue.is_active} />
                </div>
                <ChevronRight
                  aria-hidden
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              </Card>
            </motion.li>
          ))}
        </motion.ul>
      )}
      <VenueDialog open={creating} onOpenChange={setCreating} />
    </>
  )
}
