import { Ban, CalendarCheck, Flag, Pencil } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import type { Event } from '@/features/events/rules'
import { es } from '@/i18n/es'
import { useNow } from '@/lib/use-now'
import { useEventTransition, type Transition } from './api'
import { completeBlock, isEditable, publishBlock } from './rules'

const m = es.manage

/** Edit and status transitions, disabled with the reason when not possible yet. */
export function EventActions({ event }: { event: Event }) {
  const transition = useEventTransition(event.id)
  const now = useNow()

  if (!isEditable(event)) return null

  const run = (action: Transition, message: string) =>
    transition.mutate(action, { onSuccess: () => toast.success(message) })

  const blocked =
    event.status === 'DRAFT'
      ? publishBlock(event, now)
      : completeBlock(event, now)
  const busy = transition.isPending

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to={`/organizador/eventos/${event.id}/editar`}>
            <Pencil aria-hidden />
            {m.edit}
          </Link>
        </Button>
        {event.status === 'DRAFT' ? (
          <ConfirmDialog
            trigger={
              <Button disabled={blocked !== null || busy}>
                <CalendarCheck aria-hidden />
                {m.publish}
              </Button>
            }
            title={m.publishDialog.title}
            description={m.publishDialog.description}
            confirmLabel={m.publishDialog.confirm}
            cancelLabel={m.keep}
            onConfirm={() => run('publish', m.published)}
          />
        ) : (
          <ConfirmDialog
            trigger={
              <Button variant="secondary" disabled={blocked !== null || busy}>
                <Flag aria-hidden />
                {m.complete}
              </Button>
            }
            title={m.completeDialog.title}
            description={m.completeDialog.description}
            confirmLabel={m.completeDialog.confirm}
            cancelLabel={m.keep}
            onConfirm={() => run('complete', m.completed)}
          />
        )}
        <ConfirmDialog
          trigger={
            <Button
              variant="destructive"
              className="bg-danger-soft text-danger hover:bg-danger-soft/70"
              disabled={busy}
            >
              <Ban aria-hidden />
              {m.cancel}
            </Button>
          }
          title={m.cancelDialog.title}
          description={m.cancelDialog.description}
          confirmLabel={m.cancelDialog.confirm}
          cancelLabel={m.keep}
          danger
          typeToConfirm={{
            label: m.cancelDialog.typeToConfirm(event.title),
            text: event.title,
          }}
          onConfirm={() => run('cancel', m.cancelled)}
        />
      </div>
      {blocked && (
        <p className="text-sm text-muted-foreground">{m.blocked[blocked]}</p>
      )}
    </div>
  )
}
