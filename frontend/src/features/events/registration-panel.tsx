import { CircleCheck, CircleX, Hourglass, Ticket } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { es } from '@/i18n/es'
import { formatDateTime } from '@/lib/dates'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { useCancelRegistration, useRegisterForEvent } from './api'
import {
  canCancel,
  registrationBlock,
  type Event,
  type Registration,
} from './rules'

function statusLine(registration: Registration | null) {
  switch (registration?.status) {
    case 'CONFIRMED':
      return [CircleCheck, es.registration.confirmed, 'text-success'] as const
    case 'WAITLISTED':
      return [
        Hourglass,
        es.registration.waitlisted(registration.waitlist_position),
        'text-warning',
      ] as const
    case 'CANCELLED':
      return [
        CircleX,
        es.registration.cancelled,
        'text-muted-foreground',
      ] as const
    default:
      return [Ticket, es.registration.none, 'text-muted-foreground'] as const
  }
}

function blockMessage(
  event: Event,
  block: ReturnType<typeof registrationBlock>,
) {
  if (block === null) return null
  if (block === 'closed') {
    const closesAt = event.registration_closes_at ?? event.starts_at
    return es.registration.blocked.closed(
      formatDateTime(closesAt, event.timezone),
    )
  }
  return es.registration.blocked[block]
}

export function RegistrationPanel({
  event,
  registration,
}: {
  event: Event
  registration: Registration | null
}) {
  const register = useRegisterForEvent(event.id)
  const cancel = useCancelRegistration(event.id)
  const now = useNow()
  const blocked = blockMessage(event, registrationBlock(event, now))
  const active =
    registration?.status === 'CONFIRMED' ||
    registration?.status === 'WAITLISTED'
  const [Icon, text, tone] = statusLine(registration)

  function onRegister() {
    register.mutate(undefined, {
      onSuccess: ({ registration: result, created }) => {
        if (!created) toast.info(es.registration.result.unchanged)
        else if (result.status === 'CONFIRMED') {
          toast.success(es.registration.result.CONFIRMED)
        } else {
          toast.warning(
            es.registration.result.WAITLISTED(result.waitlist_position),
          )
        }
      },
    })
  }

  function onCancel() {
    cancel.mutate(undefined, {
      onSuccess: () => toast.success(es.registration.result.cancelled),
    })
  }

  const waitlisted = registration?.status === 'WAITLISTED'

  return (
    <div className="space-y-4">
      {/* Announces the result the server decided (confirmed or waitlisted). */}
      <output aria-live="polite" className="block">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`${registration?.status}-${registration?.waitlist_position}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className={cn('flex items-start gap-2 font-medium', tone)}
          >
            <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
            {text}
          </motion.span>
        </AnimatePresence>
      </output>
      {waitlisted && (
        <p className="text-sm text-muted-foreground">
          {es.registration.waitlistHint}
        </p>
      )}

      {!active && (
        <div className="space-y-2">
          <Button
            size="lg"
            className="w-full"
            disabled={blocked !== null || register.isPending}
            onClick={onRegister}
          >
            {register.isPending
              ? es.registration.registering
              : registration
                ? es.registration.registerAgain
                : es.registration.register}
          </Button>
          {blocked ? (
            <p className="text-sm text-muted-foreground">{blocked}</p>
          ) : (
            registration && (
              <p className="text-sm text-muted-foreground">
                {es.registration.registerAgainHint}
              </p>
            )
          )}
        </div>
      )}

      {active &&
        (canCancel(event, registration, now) ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full bg-danger-soft text-danger hover:bg-danger-soft/70"
                disabled={cancel.isPending}
              >
                {cancel.isPending
                  ? es.registration.cancelling
                  : waitlisted
                    ? es.registration.leaveWaitlist
                    : es.registration.cancel}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {waitlisted
                    ? es.registration.dialog.waitlistTitle
                    : es.registration.dialog.confirmTitle}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {waitlisted
                    ? es.registration.dialog.waitlistDescription
                    : es.registration.dialog.confirmDescription}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {es.registration.dialog.keep}
                </AlertDialogCancel>
                <AlertDialogAction
                  // Slot joins classes without merging them: `!` wins over the default variant.
                  className="bg-danger! text-background! hover:bg-danger/90!"
                  onClick={onCancel}
                >
                  {es.registration.dialog.confirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <p className="text-sm text-muted-foreground">
            {es.registration.cancellationClosed}
          </p>
        ))}
    </div>
  )
}
