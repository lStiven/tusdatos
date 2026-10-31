import { ArrowLeft, Building2, DoorOpen, Pencil, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { errorMessage } from '@/api/errors'
import { ConfirmSwitch } from '@/components/confirm-switch'
import { PageHeader } from '@/components/page-header'
import { StatePanel } from '@/components/state-panel'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useVenue } from '@/features/events/api'
import { useRooms } from '@/features/organizer/api'
import { es } from '@/i18n/es'
import { cn } from '@/lib/utils'
import {
  useSetRoomActive,
  useSetVenueActive,
  type Room,
  type Venue,
} from './api'
import { RoomDialog, VenueDialog } from './venue-dialogs'
import { ActiveBadge } from './venue-status'

const t = es.venues
const r = es.rooms

export function VenueDetailPage() {
  const id = Number(useParams().venueId)
  const { data: venue, error, isPending } = useVenue(id)
  const [editing, setEditing] = useState(false)

  if (isPending) return <Skeleton className="h-64 rounded-xl" />
  if (error) {
    return (
      <StatePanel
        icon={Building2}
        title={t.notFound}
        description={errorMessage(error)}
        action={{ label: t.back, to: '/admin/sedes' }}
      />
    )
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/admin/sedes">
          <ArrowLeft aria-hidden />
          {t.back}
        </Link>
      </Button>
      <PageHeader
        title={venue.name}
        description={[
          venue.city ?? t.noCity,
          venue.address ?? t.noAddress,
        ].join(' · ')}
        actions={<ActiveBadge active={venue.is_active} />}
      />
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
            {t.edit}
          </Button>
          <VenueActiveSwitch venue={venue} />
        </div>
        <RoomsCard venueId={venue.id} />
      </motion.div>
      <VenueDialog venue={venue} open={editing} onOpenChange={setEditing} />
    </>
  )
}

function VenueActiveSwitch({ venue }: { venue: Venue }) {
  const setActive = useSetVenueActive()
  return (
    <ConfirmSwitch
      checked={venue.is_active}
      label={t.active}
      ariaLabel={t.activeSwitch(venue.name)}
      disabled={setActive.isPending}
      onChange={(active) =>
        setActive.mutate(
          { id: venue.id, active },
          {
            onSuccess: () =>
              toast.success(active ? t.activated : t.deactivated),
          },
        )
      }
      confirmOff={{
        title: t.deactivateDialog.title(venue.name),
        description: t.deactivateDialog.description,
        confirmLabel: t.deactivateDialog.confirm,
        cancelLabel: t.deactivateDialog.keep,
      }}
    />
  )
}

function RoomsCard({ venueId }: { venueId: number }) {
  const rooms = useRooms(venueId)
  // `null`: closed; `'new'`: creating; a room: editing it.
  const [editing, setEditing] = useState<Room | 'new' | null>(null)

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>
          <h2>{r.title}</h2>
        </CardTitle>
        <CardDescription>{r.hint}</CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            {r.create}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {rooms.isPending ? (
          <Skeleton className="h-24" />
        ) : rooms.isError ? (
          <p className="text-sm text-destructive">
            {errorMessage(rooms.error)}
          </p>
        ) : rooms.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{r.empty}</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {rooms.data.map((room) => (
              <li
                key={room.id}
                className={cn(
                  'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3',
                  !room.is_active && 'bg-muted/40',
                )}
              >
                <DoorOpen
                  aria-hidden
                  className="size-4 text-muted-foreground"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{room.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.capacity(room.capacity)}
                  </p>
                </div>
                <RoomActiveSwitch venueId={venueId} room={room} />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={r.edit(room.name)}
                  onClick={() => setEditing(room)}
                >
                  <Pencil aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <RoomDialog
        venueId={venueId}
        room={editing === 'new' || editing === null ? undefined : editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </Card>
  )
}

function RoomActiveSwitch({ venueId, room }: { venueId: number; room: Room }) {
  const setActive = useSetRoomActive(venueId)
  return (
    <ConfirmSwitch
      checked={room.is_active}
      label={t.active}
      ariaLabel={r.activeSwitch(room.name)}
      disabled={setActive.isPending}
      onChange={(active) =>
        setActive.mutate(
          { id: room.id, active },
          {
            onSuccess: () =>
              toast.success(active ? r.activated : r.deactivated),
          },
        )
      }
      confirmOff={{
        title: r.deactivateDialog.title(room.name),
        description: r.deactivateDialog.description,
        confirmLabel: r.deactivateDialog.confirm,
        cancelLabel: r.deactivateDialog.keep,
      }}
    />
  )
}
