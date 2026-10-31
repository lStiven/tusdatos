import { DoorOpen, Flame, Heart, TriangleAlert, UsersRound } from 'lucide-react'
import { motion } from 'motion/react'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { es } from '@/i18n/es'
import { dayKey, formatDay, formatTime } from '@/lib/dates'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { useToggleInterest } from './api'
import {
  interestBlock,
  overlapping,
  type Event,
  type Registration,
  type Session,
} from './rules'

const list = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

/** Sessions arrive ordered by start time; groups them by day in the event's zone. */
function byDay(sessions: Session[], timeZone: string) {
  const days = new Map<string, Session[]>()
  for (const session of sessions) {
    const key = dayKey(session.starts_at, timeZone)
    days.set(key, [...(days.get(key) ?? []), session])
  }
  return [...days.values()]
}

const quoted = (sessions: Session[]) =>
  sessions.map((session) => `«${session.title}»`).join(', ')

export function Agenda({
  event,
  sessions,
  registration,
}: {
  event: Event
  sessions: Session[]
  registration: Registration | null
}) {
  const toggle = useToggleInterest(event.id)
  const now = useNow()

  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">{es.agenda.empty}</p>
  }

  return (
    <div className="space-y-8">
      {byDay(sessions, event.timezone).map((day) => (
        <section key={day[0]!.id} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground first-letter:uppercase">
            {formatDay(day[0]!.starts_at, event.timezone)}
          </h3>
          <motion.ol
            className="space-y-3"
            variants={list}
            initial="hidden"
            animate="show"
          >
            {day.map((session) => (
              <motion.li key={session.id} variants={item} layout>
                <SessionItem
                  session={session}
                  timeZone={event.timezone}
                  block={interestBlock(session, registration, now)}
                  overlaps={
                    session.is_interested ? overlapping(session, sessions) : []
                  }
                  onToggle={() =>
                    toggle.mutate({
                      session,
                      interested: !session.is_interested,
                    })
                  }
                />
              </motion.li>
            ))}
          </motion.ol>
        </section>
      ))}
    </div>
  )
}

function SessionItem({
  session,
  timeZone,
  block,
  overlaps,
  onToggle,
}: {
  session: Session
  timeZone: string
  block: ReturnType<typeof interestBlock>
  overlaps: Session[]
  onToggle: () => void
}) {
  const cancelled = session.status === 'CANCELLED'
  // Withdrawing is always allowed; marking follows the rules.
  const disabled = !session.is_interested && block !== null
  const reasonId = `session-${session.id}-reason`

  return (
    <article
      className={cn(
        'flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-md sm:flex-row',
        cancelled && 'border-dashed bg-muted/40 shadow-none',
      )}
    >
      <p className="shrink-0 text-sm font-medium tabular-nums sm:w-28">
        {formatTime(session.starts_at, timeZone)}–
        {formatTime(session.ends_at, timeZone)}
      </p>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className={cn('font-semibold', cancelled && 'line-through')}>
            {session.title}
          </h4>
          {session.status !== 'SCHEDULED' && (
            <StatusBadge kind="session" status={session.status} />
          )}
          {session.overdemand && !cancelled && (
            <Badge
              title={es.agenda.overdemandHint}
              className="border-transparent bg-warning-soft text-warning"
            >
              <Flame aria-hidden />
              {es.agenda.overdemand}
            </Badge>
          )}
        </div>
        {session.description && (
          <p className="text-sm text-muted-foreground">{session.description}</p>
        )}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <DoorOpen aria-hidden className="size-4" />
            {session.room?.name ?? es.agenda.noRoom}
          </li>
          {session.speakers.length > 0 && (
            <li className="flex items-center gap-1.5">
              <UsersRound aria-hidden className="size-4" />
              {es.agenda.speakers(
                session.speakers.map((speaker) => speaker.full_name).join(', '),
              )}
            </li>
          )}
          <li>{es.agenda.interest(session.interested, session.capacity)}</li>
        </ul>
        {overlaps.length > 0 && (
          <p className="flex items-start gap-1.5 text-sm text-warning">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {es.agenda.overlaps(quoted(overlaps))}
          </p>
        )}
      </div>
      {!cancelled && (
        <div className="shrink-0 space-y-1 sm:w-44 sm:text-right">
          <Button
            variant={session.is_interested ? 'default' : 'outline'}
            size="sm"
            aria-pressed={session.is_interested}
            aria-label={es.agenda.interestLabel(session.title)}
            aria-describedby={disabled ? reasonId : undefined}
            disabled={disabled}
            onClick={onToggle}
          >
            <Heart
              aria-hidden
              className={cn(session.is_interested && 'fill-current')}
            />
            {es.agenda.markInterest}
          </Button>
          {disabled && block && (
            <p id={reasonId} className="text-xs text-muted-foreground">
              {es.agenda.blocked[block]}
            </p>
          )}
        </div>
      )}
    </article>
  )
}
