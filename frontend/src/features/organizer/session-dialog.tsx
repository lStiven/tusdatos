import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  Field,
  FormField,
  SelectField,
  TextareaField,
} from '@/components/form-field'
import { DateTimeField } from '@/components/date-time-field'
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
import { Input } from '@/components/ui/input'
import type { Event, Session } from '@/features/events/rules'
import { useSpeakers } from '@/features/speakers/api'
import { es } from '@/i18n/es'
import {
  formLevelError,
  showFieldErrors,
  type CodeFields,
} from '@/lib/form-errors'
import { fromZonedInput, toZonedInput } from '@/lib/dates'
import { useReturnFocus } from '@/lib/use-return-focus'
import { useRooms, useSaveSession, type SessionInput } from './api'

const f = es.sessionsAdmin.form
const v = es.eventForm.validation
const HOUR = 3_600_000

function schemaFor(start: string, end: string) {
  // `YYYY-MM-DDTHH:mm` strings in the event's zone compare as instants.
  return z
    .object({
      title: z.string().trim().min(1, v.title).max(200),
      description: z.string().max(10_000),
      capacity: z
        .string()
        .regex(/^\d+$/, v.capacity)
        .refine((value) => +value > 0, v.capacity),
      starts_at: z.string().min(1, v.date),
      ends_at: z.string().min(1, v.date),
      room_id: z.string(),
      speaker_ids: z.array(z.string()),
    })
    .superRefine((data, ctx) => {
      if (data.starts_at && data.ends_at && data.ends_at <= data.starts_at) {
        ctx.addIssue({
          code: 'custom',
          path: ['ends_at'],
          message: v.endsBeforeStart,
        })
      } else if (data.starts_at < start || data.ends_at > end) {
        ctx.addIssue({
          code: 'custom',
          path: ['starts_at'],
          message: v.outsideEvent,
        })
      }
    })
}

type Values = z.infer<ReturnType<typeof schemaFor>>

const fieldOf: CodeFields<Values> = {
  room_not_available: 'room_id',
  capacity_exceeds_room: 'room_id',
  room_not_in_event_venue: 'room_id',
  room_inactive: 'room_id',
  session_requires_room: 'room_id',
  speaker_not_available: 'speaker_ids',
  speaker_not_found: 'speaker_ids',
  session_outside_event: 'starts_at',
  invalid_session_schedule: 'ends_at',
}

function toValues(event: Event, session?: Session): Values {
  const zoned = (iso: string) => toZonedInput(iso, event.timezone)
  if (!session) {
    const start = Date.parse(event.starts_at)
    const end = Math.min(start + HOUR, Date.parse(event.ends_at))
    return {
      title: '',
      description: '',
      capacity: '',
      starts_at: zoned(event.starts_at),
      ends_at: zoned(new Date(end).toISOString()),
      room_id: '',
      speaker_ids: [],
    }
  }
  return {
    title: session.title,
    description: session.description ?? '',
    capacity: String(session.capacity),
    starts_at: zoned(session.starts_at),
    ends_at: zoned(session.ends_at),
    room_id: session.room ? String(session.room.id) : '',
    speaker_ids: session.speakers.map((speaker) => String(speaker.id)),
  }
}

function toBody(values: Values, timeZone: string): SessionInput {
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    capacity: Number(values.capacity),
    starts_at: fromZonedInput(values.starts_at, timeZone),
    ends_at: fromZonedInput(values.ends_at, timeZone),
    room_id: values.room_id ? Number(values.room_id) : null,
    speaker_ids: values.speaker_ids.map(Number),
  }
}

/** Create (`session` omitted) or edit a session of the event. */
export function SessionDialog({
  event,
  session,
  open,
  onOpenChange,
}: {
  event: Event
  session?: Session
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const returnFocus = useReturnFocus()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...returnFocus}
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>{session ? f.editTitle : f.createTitle}</DialogTitle>
          <DialogDescription>
            {f.description} ({event.timezone})
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open: each opening starts from fresh values. */}
        {open && (
          <SessionForm
            event={event}
            session={session}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function SessionForm({
  event,
  session,
  onDone,
}: {
  event: Event
  session?: Session
  onDone: () => void
}) {
  const save = useSaveSession(event.id, session?.id)
  const rooms = useRooms(event.venue_id)
  const [speakerFilter, setSpeakerFilter] = useState('')
  const speakers = useSpeakers({
    name: speakerFilter.trim() || undefined,
    limit: 100,
    offset: 0,
  })
  const zoned = (iso: string) => toZonedInput(iso, event.timezone)
  const schema = schemaFor(zoned(event.starts_at), zoned(event.ends_at))

  const { register, handleSubmit, setError, control, formState } =
    useForm<Values>({
      resolver: zodResolver(schema),
      defaultValues: toValues(event, session),
    })
  const errors = formState.errors
  const [roomId, capacity, selected] = useWatch({
    control,
    name: ['room_id', 'capacity', 'speaker_ids'],
  })
  const activeRooms = rooms.data?.filter((room) => room.is_active) ?? []
  const room = activeRooms.find((item) => String(item.id) === roomId)
  const overRoom = room && Number(capacity) > room.capacity

  const submit = handleSubmit((values) =>
    save.mutate(toBody(values, event.timezone), {
      onSuccess: () => {
        toast.success(
          session ? es.sessionsAdmin.saved : es.sessionsAdmin.created,
        )
        onDone()
      },
      onError: (error) =>
        showFieldErrors(error, setError, Object.keys(schema.shape), fieldOf),
    }),
  )
  const formLevel = formLevelError(save.error, fieldOf)

  return (
    <form noValidate onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="empty:hidden sm:col-span-2">
        <FormNotice message={formLevel} />
      </div>
      <div className="sm:col-span-2">
        <FormField
          label={f.title}
          error={errors.title?.message}
          {...register('title')}
        />
      </div>
      <div className="sm:col-span-2">
        <TextareaField
          label={f.summary}
          error={errors.description?.message}
          {...register('description')}
        />
      </div>
      <Controller
        control={control}
        name="starts_at"
        render={({ field }) => (
          <DateTimeField
            label={es.eventForm.startsAt}
            error={errors.starts_at?.message}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
      <Controller
        control={control}
        name="ends_at"
        render={({ field }) => (
          <DateTimeField
            label={es.eventForm.endsAt}
            error={errors.ends_at?.message}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
      <Controller
        control={control}
        name="room_id"
        render={({ field }) => (
          <SelectField
            label={f.room}
            hint={event.venue_id === null ? f.noVenue : f.roomHint}
            disabled={event.venue_id === null}
            error={errors.room_id?.message}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            options={[
              { value: '', label: f.noRoom },
              ...activeRooms.map((item) => ({
                value: String(item.id),
                label: f.roomOption(item.name, item.capacity),
              })),
            ]}
          />
        )}
      />
      <FormField
        label={f.capacity}
        type="number"
        inputMode="numeric"
        min={1}
        hint={overRoom ? f.capacityOverRoom(room.capacity) : undefined}
        error={errors.capacity?.message}
        {...register('capacity')}
      />
      <Field
        label={f.speakers}
        hint={f.selectedSpeakers(selected.length)}
        error={errors.speaker_ids?.message}
        className="sm:col-span-2"
      >
        {(fieldControl) => (
          <div className="space-y-2">
            <Input
              {...fieldControl}
              type="search"
              placeholder={f.speakersFilter}
              value={speakerFilter}
              onChange={(change) => setSpeakerFilter(change.target.value)}
            />
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
              {speakers.data?.items.length === 0 && (
                <li className="px-1 text-sm text-muted-foreground">
                  {f.noSpeakers}
                </li>
              )}
              {speakers.data?.items.map((speaker) => (
                <li key={speaker.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      value={String(speaker.id)}
                      className="size-4 accent-primary"
                      {...register('speaker_ids')}
                    />
                    {speaker.full_name}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Field>
      <DialogFooter className="sm:col-span-2">
        <Button type="button" variant="outline" onClick={onDone}>
          {f.close}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? f.saving : f.save}
        </Button>
      </DialogFooter>
    </form>
  )
}
