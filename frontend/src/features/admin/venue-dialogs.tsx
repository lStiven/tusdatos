import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormField } from '@/components/form-field'
import { FormNotice } from '@/components/form-notice'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { es } from '@/i18n/es'
import { useReturnFocus } from '@/lib/use-return-focus'
import {
  formLevelError,
  showFieldErrors,
  type CodeFields,
} from '@/lib/form-errors'
import { useSaveRoom, useSaveVenue, type Room, type Venue } from './api'

const MAX_ROOM_CAPACITY = 100_000

/** Dialog whose form mounts only while open, so each opening starts fresh. */
function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  children: React.ReactNode
}) {
  const returnFocus = useReturnFocus()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent {...returnFocus}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {open && children}
      </DialogContent>
    </Dialog>
  )
}

function Footer({
  pending,
  labels,
  onClose,
}: {
  pending: boolean
  labels: { save: string; saving: string; close: string }
  onClose: () => void
}) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onClose}>
        {labels.close}
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? labels.saving : labels.save}
      </Button>
    </DialogFooter>
  )
}

const venueSchema = z.object({
  name: z.string().trim().min(1, es.venues.form.validation.name).max(160),
  address: z.string().max(300),
  city: z.string().max(120),
})

type VenueValues = z.infer<typeof venueSchema>

/** Create (`venue` omitted) or edit a venue. */
export function VenueDialog({
  venue,
  open,
  onOpenChange,
}: {
  venue?: Venue
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const f = es.venues.form
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={venue ? f.editTitle : f.createTitle}
      description={f.description}
    >
      <VenueForm venue={venue} onDone={() => onOpenChange(false)} />
    </FormDialog>
  )
}

function VenueForm({ venue, onDone }: { venue?: Venue; onDone: () => void }) {
  const f = es.venues.form
  const save = useSaveVenue(venue?.id)
  const { register, handleSubmit, setError, formState } = useForm<VenueValues>({
    resolver: zodResolver(venueSchema),
    defaultValues: {
      name: venue?.name ?? '',
      address: venue?.address ?? '',
      city: venue?.city ?? '',
    },
  })

  const submit = handleSubmit((values) =>
    save.mutate(
      {
        name: values.name.trim(),
        // Empty clears the field (the API accepts `null`).
        address: values.address.trim() || null,
        city: values.city.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(venue ? es.venues.saved : es.venues.created)
          onDone()
        },
        onError: (error) =>
          showFieldErrors(error, setError, Object.keys(venueSchema.shape)),
      },
    ),
  )

  return (
    <form noValidate onSubmit={submit} className="grid gap-4">
      <FormNotice message={formLevelError(save.error)} />
      <FormField
        label={f.name}
        error={formState.errors.name?.message}
        {...register('name')}
      />
      <FormField
        label={f.address}
        error={formState.errors.address?.message}
        {...register('address')}
      />
      <FormField
        label={f.city}
        error={formState.errors.city?.message}
        {...register('city')}
      />
      <Footer pending={save.isPending} labels={f} onClose={onDone} />
    </form>
  )
}

const roomSchema = z.object({
  name: z.string().trim().min(1, es.rooms.form.validation.name).max(160),
  capacity: z
    .string()
    .regex(/^\d+$/, es.rooms.form.validation.capacity)
    .refine(
      (value) => +value > 0 && +value <= MAX_ROOM_CAPACITY,
      es.rooms.form.validation.capacity,
    ),
})

type RoomValues = z.infer<typeof roomSchema>

/** Business errors that belong to one field; the rest go above the form. */
const roomFieldOf: CodeFields<RoomValues> = {
  room_name_taken: 'name',
  room_capacity_below_sessions: 'capacity',
}

/** Create (`room` omitted) or edit a room of the venue. */
export function RoomDialog({
  venueId,
  room,
  open,
  onOpenChange,
}: {
  venueId: number
  room?: Room
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const f = es.rooms.form
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={room ? f.editTitle : f.createTitle}
      description={f.description}
    >
      <RoomForm
        venueId={venueId}
        room={room}
        onDone={() => onOpenChange(false)}
      />
    </FormDialog>
  )
}

function RoomForm({
  venueId,
  room,
  onDone,
}: {
  venueId: number
  room?: Room
  onDone: () => void
}) {
  const f = es.rooms.form
  const save = useSaveRoom(venueId, room?.id)
  const { register, handleSubmit, setError, formState } = useForm<RoomValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      name: room?.name ?? '',
      capacity: room ? String(room.capacity) : '',
    },
  })

  const submit = handleSubmit((values) =>
    save.mutate(
      { name: values.name.trim(), capacity: Number(values.capacity) },
      {
        onSuccess: () => {
          toast.success(room ? es.rooms.saved : es.rooms.created)
          onDone()
        },
        onError: (error) =>
          showFieldErrors(
            error,
            setError,
            Object.keys(roomSchema.shape),
            roomFieldOf,
          ),
      },
    ),
  )
  const formLevel = formLevelError(save.error, roomFieldOf)

  return (
    <form noValidate onSubmit={submit} className="grid gap-4">
      <FormNotice message={formLevel} />
      <FormField
        label={f.name}
        error={formState.errors.name?.message}
        {...register('name')}
      />
      <FormField
        label={f.capacity}
        type="number"
        inputMode="numeric"
        min={1}
        hint={room ? f.capacityHint : undefined}
        error={formState.errors.capacity?.message}
        {...register('capacity')}
      />
      <Footer pending={save.isPending} labels={f} onClose={onDone} />
    </form>
  )
}
