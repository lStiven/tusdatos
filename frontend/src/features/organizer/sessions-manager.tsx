import {
  CalendarCheck,
  CalendarMinus,
  DoorOpen,
  EllipsisVertical,
  Pencil,
  Plus,
  TriangleAlert,
  UsersRound,
  XCircle,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useSessions } from '@/features/events/api'
import type { Event, Session } from '@/features/events/rules'
import { es } from '@/i18n/es'
import { formatDay, formatTime } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useReturnFocus } from '@/lib/use-return-focus'
import { useSessionAction, type SessionAction } from './api'
import { isEditable, scheduleBlock } from './rules'
import { SessionDialog } from './session-dialog'

const s = es.sessionsAdmin
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

const toasts: Record<SessionAction, string> = {
  schedule: s.scheduled,
  unschedule: s.unscheduled,
  cancel: s.cancelledToast,
}

export function SessionsManager({ event }: { event: Event }) {
  const sessions = useSessions(event.id)
  const action = useSessionAction(event.id)
  // `null`: closed; `'new'`: creating; a session: editing it.
  const [editing, setEditing] = useState<Session | 'new' | null>(null)
  const [cancelling, setCancelling] = useState<Session | null>(null)
  const editable = isEditable(event)
  const returnFocus = useReturnFocus()

  const run = (session: Session, kind: SessionAction) =>
    action.mutate(
      { id: session.id, action: kind },
      { onSuccess: () => toast.success(toasts[kind]) },
    )

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>
          <h2>{s.title}</h2>
        </CardTitle>
        <CardDescription>{s.hint}</CardDescription>
        {editable && (
          <CardAction>
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus aria-hidden />
              {s.create}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {sessions.isPending ? (
          <Skeleton className="h-24" />
        ) : sessions.isError ? (
          <p className="text-sm text-destructive">{es.agenda.loadError}</p>
        ) : sessions.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{s.empty}</p>
        ) : (
          <motion.ol
            className="space-y-3"
            initial="hidden"
            animate="show"
            transition={{ staggerChildren: 0.05 }}
          >
            {sessions.data.map((session) => (
              <motion.li key={session.id} variants={item} layout>
                <SessionRow
                  session={session}
                  timeZone={event.timezone}
                  actions={
                    editable && session.status !== 'CANCELLED' ? (
                      <SessionMenu
                        session={session}
                        busy={action.isPending}
                        onEdit={() => setEditing(session)}
                        onRun={(kind) => run(session, kind)}
                        onCancel={() => setCancelling(session)}
                      />
                    ) : null
                  }
                />
              </motion.li>
            ))}
          </motion.ol>
        )}
      </CardContent>

      <SessionDialog
        event={event}
        session={editing === 'new' || editing === null ? undefined : editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <AlertDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
      >
        <AlertDialogContent {...returnFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>{s.cancelDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {s.cancelDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{es.manage.keep}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger! text-background! hover:bg-danger/90!"
              onClick={() => cancelling && run(cancelling, 'cancel')}
            >
              {s.cancelDialog.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function SessionMenu({
  session,
  busy,
  onEdit,
  onRun,
  onCancel,
}: {
  session: Session
  busy: boolean
  onEdit: () => void
  onRun: (action: SessionAction) => void
  onCancel: () => void
}) {
  const blocked = session.status === 'DRAFT' ? scheduleBlock(session) : null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={busy}
          aria-label={s.actions(session.title)}
        >
          <EllipsisVertical aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil aria-hidden />
          {s.edit}
        </DropdownMenuItem>
        {session.status === 'DRAFT' ? (
          <DropdownMenuItem
            disabled={blocked !== null}
            onSelect={() => onRun('schedule')}
          >
            <CalendarCheck aria-hidden />
            {s.schedule}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onRun('unschedule')}>
            <CalendarMinus aria-hidden />
            {s.unschedule}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          variant="destructive"
          // The default red does not reach AA contrast on light backgrounds.
          className="data-[variant=destructive]:text-danger data-[variant=destructive]:*:[svg]:text-danger"
          onSelect={onCancel}
        >
          <XCircle aria-hidden />
          {s.cancel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SessionRow({
  session,
  timeZone,
  actions,
}: {
  session: Session
  timeZone: string
  actions: ReactNode
}) {
  const cancelled = session.status === 'CANCELLED'
  const blocked = session.status === 'DRAFT' ? scheduleBlock(session) : null
  return (
    <article
      className={cn(
        'flex gap-3 rounded-xl border bg-card p-4 shadow-xs',
        cancelled && 'border-dashed bg-muted/40 shadow-none',
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm text-muted-foreground first-letter:uppercase">
          {formatDay(session.starts_at, timeZone)} ·{' '}
          <span className="font-medium text-foreground tabular-nums">
            {formatTime(session.starts_at, timeZone)}–
            {formatTime(session.ends_at, timeZone)}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={cn('font-semibold', cancelled && 'line-through')}>
            {session.title}
          </h3>
          <StatusBadge kind="session" status={session.status} />
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <DoorOpen aria-hidden className="size-4" />
            {session.room
              ? es.sessionsAdmin.form.roomOption(
                  session.room.name,
                  session.room.capacity,
                )
              : es.agenda.noRoom}
          </li>
          {session.speakers.length > 0 && (
            <li className="flex items-center gap-1.5">
              <UsersRound aria-hidden className="size-4" />
              {session.speakers.map((speaker) => speaker.full_name).join(', ')}
            </li>
          )}
          <li>{es.agenda.interest(session.interested, session.capacity)}</li>
        </ul>
        {blocked && (
          <p className="flex items-center gap-1.5 text-sm text-warning">
            <TriangleAlert aria-hidden className="size-4 shrink-0" />
            {blocked === 'needsRoom'
              ? s.needsRoom
              : s.roomTooSmall(session.room?.capacity ?? 0)}
          </p>
        )}
      </div>
      {actions}
    </article>
  )
}
