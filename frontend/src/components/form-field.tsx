import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { es } from '@/i18n/es'

interface FormFieldProps extends ComponentProps<typeof Input> {
  label: string
  hint?: string
  error?: string
}

function FieldMessages({
  hintId,
  errorId,
  hint,
  error,
}: {
  hintId: string
  errorId: string
  hint?: string
  error?: string
}) {
  return (
    <>
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={errorId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs font-medium text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </>
  )
}

/** Label, input, hint and error, wired for assistive tech (`aria-describedby`). */
export function FormField({
  label,
  hint,
  error,
  children,
  ...input
}: FormFieldProps & { children?: ReactNode }) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy =
    [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-10"
          {...input}
        />
        {children}
      </div>
      <FieldMessages
        hintId={hintId}
        errorId={errorId}
        hint={hint}
        error={error}
      />
    </div>
  )
}

export function PasswordField(props: Omit<FormFieldProps, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <FormField
      {...props}
      type={visible ? 'text' : 'password'}
      className="h-10 pr-10"
    >
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? es.a11y.hidePassword : es.a11y.showPassword}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {visible ? (
          <EyeOff aria-hidden className="size-4" />
        ) : (
          <Eye aria-hidden className="size-4" />
        )}
      </button>
    </FormField>
  )
}
