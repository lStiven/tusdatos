import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, CalendarX2, Lock, ShieldX } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { ApiError, errorMessage, fieldErrors } from '@/api/errors'
import { FormField, SelectField, TextareaField } from '@/components/form-field'
import { FormNotice } from '@/components/form-notice'
import { PageHeader } from '@/components/page-header'
import { StatePanel } from '@/components/state-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/auth/api'
import { useEvent, useOccupancy, useSessions } from '@/features/events/api'
import type { Event } from '@/features/events/rules'
import { es } from '@/i18n/es'
import { fromZonedInput, isTimeZone, toZonedInput } from '@/lib/dates'
import { can } from '@/lib/permissions'
import { useActiveVenues, useSaveEvent, type EventInput } from './api'
import { isEditable } from './rules'

const v = es.eventForm.validation
const MAX_CAPACITY = 100_000

// Datetimes are `YYYY-MM-DDTHH:mm` in the event's zone: comparing the strings
// compares the instants.
const schema = z
  .object({
    title: z.string().trim().min(1, v.title).max(200),
    description: z.string().max(10_000),
    capacity: z
      .string()
      .regex(/^\d+$/, v.capacity)
      .refine((value) => +value > 0 && +value <= MAX_CAPACITY, v.capacity),
    timezone: z.string().trim().refine(isTimeZone, v.timezone),
    starts_at: z.string().min(1, v.date),
    ends_at: z.string().min(1, v.date),
    registration_closes_at: z.string(),
    venue_id: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.starts_at && data.ends_at && data.ends_at <= data.starts_at) {
      ctx.addIssue({
        code: 'custom',
        path: ['ends_at'],
        message: v.endsBeforeStart,
      })
    }
    if (
      data.registration_closes_at &&
      data.ends_at &&
      data.registration_closes_at > data.ends_at
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['registration_closes_at'],
        message: v.closesAfterEnd,
      })
    }
  })

type Values = z.infer<typeof schema>

/** Business errors that belong to one field; the rest go above the form. */
const fieldOf: Partial<Record<string, keyof Values>> = {
  capacity_below_confirmed: 'capacity',
  invalid_event_schedule: 'ends_at',
  sessions_outside_event: 'starts_at',
  event_has_scheduled_sessions: 'venue_id',
  event_requires_venue: 'venue_id',
  venue_inactive: 'venue_id',
  venue_not_found: 'venue_id',
}

function toValues(event?: Event): Values {
  if (!event) {
    return {
      title: '',
      description: '',
      capacity: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      starts_at: '',
      ends_at: '',
      registration_closes_at: '',
      venue_id: '',
    }
  }
  const zoned = (iso: string) => toZonedInput(iso, event.timezone)
  return {
    title: event.title,
    description: event.description ?? '',
    capacity: String(event.capacity),
    timezone: event.timezone,
    starts_at: zoned(event.starts_at),
    ends_at: zoned(event.ends_at),
    registration_closes_at: event.registration_closes_at
      ? zoned(event.registration_closes_at)
      : '',
    venue_id: event.venue_id === null ? '' : String(event.venue_id),
  }
}

/** `venueLocked`: the venue cannot change, so it is left out of the body. */
function toBody(values: Values, venueLocked: boolean): EventInput {
  const zone = values.timezone.trim()
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    capacity: Number(values.capacity),
    timezone: zone,
    starts_at: fromZonedInput(values.starts_at, zone),
    ends_at: fromZonedInput(values.ends_at, zone),
    registration_closes_at: values.registration_closes_at
      ? fromZonedInput(values.registration_closes_at, zone)
      : null,
    venue_id: venueLocked
      ? undefined
      : values.venue_id
        ? Number(values.venue_id)
        : null,
  }
}

function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
      <Link to={to}>
        <ArrowLeft aria-hidden />
        {label}
      </Link>
    </Button>
  )
}

export function NewEventPage() {
  return (
    <>
      <BackLink to="/organizador/eventos" label={es.eventForm.backToList} />
      <PageHeader
        title={es.eventForm.createTitle}
        description={es.eventForm.createSubtitle}
      />
      <EventForm />
    </>
  )
}

export function EditEventPage() {
  const id = Number(useParams().eventId)
  const { data: user } = useCurrentUser()
  const { data: event, error, isPending } = useEvent(id)

  if (isPending || !user) return <Skeleton className="h-96 rounded-xl" />
  if (error) {
    return (
      <StatePanel
        icon={CalendarX2}
        title={es.eventDetail.notFoundTitle}
        description={errorMessage(error)}
        action={{ label: es.eventForm.backToList, to: '/organizador/eventos' }}
      />
    )
  }
  if (!can(user, 'event:manage', event)) {
    return (
      <StatePanel
        icon={ShieldX}
        title={es.manage.forbiddenTitle}
        description={es.manage.forbiddenDescription}
        action={{ label: es.eventForm.backToList, to: '/organizador/eventos' }}
      />
    )
  }
  if (!isEditable(event)) {
    return (
      <StatePanel
        icon={Lock}
        title={es.eventForm.editTitle(event.title)}
        description={es.eventForm.notEditable}
        action={{
          label: es.eventForm.back,
          to: `/organizador/eventos/${event.id}`,
        }}
      />
    )
  }
  return (
    <>
      <BackLink to={`/organizador/eventos/${id}`} label={es.eventForm.back} />
      <PageHeader title={es.eventForm.editTitle(event.title)} />
      <EventForm event={event} />
    </>
  )
}

function EventForm({ event }: { event?: Event }) {
  const navigate = useNavigate()
  const save = useSaveEvent(event?.id)
  const venues = useActiveVenues()
  // Only needed when editing: the hints depend on the current state.
  const occupancy = useOccupancy(event?.id ?? 0, event !== undefined)
  const sessions = useSessions(event?.id ?? 0, event !== undefined)
  const venueLocked =
    sessions.data?.some((session) => session.status === 'SCHEDULED') ?? false

  const { register, handleSubmit, setError, control, formState } =
    useForm<Values>({
      resolver: zodResolver(schema),
      defaultValues: toValues(event),
    })
  const errors = formState.errors

  const submit = handleSubmit((values) =>
    save.mutate(toBody(values, venueLocked), {
      onSuccess: (saved) => {
        toast.success(event ? es.eventForm.saved : es.eventForm.created)
        navigate(`/organizador/eventos/${saved.id}`)
      },
      onError: (error) => {
        const field =
          error instanceof ApiError ? fieldOf[error.code] : undefined
        if (field) setError(field, { message: errorMessage(error) })
        for (const [name, message] of Object.entries(fieldErrors(error))) {
          if (name in schema.shape) setError(name as keyof Values, { message })
        }
      },
    }),
  )

  const formLevel =
    save.error && save.error.status !== 422 && !fieldOf[save.error.code]
      ? errorMessage(save.error)
      : null
  const confirmed = occupancy.data?.confirmed

  return (
    <Card className="shadow-sm">
      <CardContent>
        <form
          noValidate
          onSubmit={submit}
          className="grid gap-5 md:grid-cols-2"
        >
          <div className="empty:hidden md:col-span-2">
            <FormNotice message={formLevel} />
          </div>
          <div className="md:col-span-2">
            <FormField
              label={es.eventForm.title}
              error={errors.title?.message}
              {...register('title')}
            />
          </div>
          <div className="md:col-span-2">
            <TextareaField
              label={es.eventForm.description}
              error={errors.description?.message}
              {...register('description')}
            />
          </div>
          <FormField
            label={es.eventForm.capacity}
            type="number"
            inputMode="numeric"
            min={1}
            hint={
              confirmed === undefined
                ? undefined
                : `${es.eventForm.capacityHint(confirmed)} ${es.eventForm.capacityRaiseHint}`
            }
            error={errors.capacity?.message}
            {...register('capacity')}
          />
          <FormField
            label={es.eventForm.timezone}
            list="time-zones"
            autoComplete="off"
            hint={es.eventForm.timezoneHint}
            error={errors.timezone?.message}
            {...register('timezone')}
          />
          <datalist id="time-zones">
            {Intl.supportedValuesOf('timeZone').map((zone) => (
              <option key={zone}>{zone}</option>
            ))}
          </datalist>
          <FormField
            label={es.eventForm.startsAt}
            type="datetime-local"
            error={errors.starts_at?.message}
            {...register('starts_at')}
          />
          <FormField
            label={es.eventForm.endsAt}
            type="datetime-local"
            error={errors.ends_at?.message}
            {...register('ends_at')}
          />
          <FormField
            label={es.eventForm.closesAt}
            type="datetime-local"
            hint={es.eventForm.closesAtHint}
            error={errors.registration_closes_at?.message}
            {...register('registration_closes_at')}
          />
          <Controller
            control={control}
            name="venue_id"
            render={({ field }) => (
              <SelectField
                label={es.eventForm.venue}
                hint={
                  venueLocked
                    ? es.eventForm.venueLocked
                    : es.eventForm.venueHint
                }
                disabled={venueLocked}
                error={errors.venue_id?.message}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                options={[
                  { value: '', label: es.eventForm.noVenue },
                  ...(venues.data ?? []).map((venue) => ({
                    value: String(venue.id),
                    label: [venue.name, venue.city].filter(Boolean).join(' · '),
                  })),
                ]}
              />
            )}
          />
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button type="submit" size="lg" disabled={save.isPending}>
              {save.isPending
                ? es.eventForm.saving
                : event
                  ? es.eventForm.save
                  : es.eventForm.create}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
