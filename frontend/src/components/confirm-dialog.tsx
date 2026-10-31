import { useId, useState, type ReactNode } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Asks before an action, saying its effect. With `typeToConfirm`, the user must
 * type that text first: for final actions with wide effects.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  danger = false,
  typeToConfirm,
}: {
  trigger: ReactNode
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  danger?: boolean
  typeToConfirm?: { label: string; text: string }
}) {
  const [typed, setTyped] = useState('')
  const inputId = useId()
  const ready = !typeToConfirm || typed.trim() === typeToConfirm.text

  return (
    <AlertDialog onOpenChange={() => setTyped('')}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {typeToConfirm && (
          <div className="grid gap-1.5">
            <Label htmlFor={inputId}>{typeToConfirm.label}</Label>
            <Input
              id={inputId}
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={!ready}
            onClick={onConfirm}
            // Slot joins classes without merging them: `!` wins over the variant.
            className={cn(
              danger && 'bg-danger! text-background! hover:bg-danger/90!',
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
