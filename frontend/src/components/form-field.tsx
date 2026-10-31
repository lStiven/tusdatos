import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { es } from '@/i18n/es'
import { cn } from '@/lib/utils'

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

export interface ControlProps {
  id: string
  'aria-invalid'?: true
  'aria-describedby'?: string
}

/** Label, control, hint and error, wired for assistive tech (`aria-describedby`). */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string
  hint?: string
  error?: string
  className?: string
  children: (control: ControlProps) => ReactNode
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy =
    [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })}
      <FieldMessages
        hintId={hintId}
        errorId={errorId}
        hint={hint}
        error={error}
      />
    </div>
  )
}

export function FormField({
  label,
  hint,
  error,
  children,
  className,
  ...input
}: FormFieldProps & { children?: ReactNode }) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => (
        <div className="relative">
          <Input {...control} className={cn('h-10', className)} {...input} />
          {children}
        </div>
      )}
    </Field>
  )
}

export function TextareaField({
  label,
  hint,
  error,
  ...textarea
}: ComponentProps<typeof Textarea> & {
  label: string
  hint?: string
  error?: string
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => <Textarea {...control} rows={3} {...textarea} />}
    </Field>
  )
}

/** Native `<select>`: accessible and keyboard-friendly on every device. */
export function SelectField({
  label,
  hint,
  error,
  className,
  ...select
}: ComponentProps<'select'> & {
  label: string
  hint?: string
  error?: string
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => (
        <select
          {...control}
          className={cn(
            'h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30',
            className,
          )}
          {...select}
        />
      )}
    </Field>
  )
}

export function PasswordField(props: Omit<FormFieldProps, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <FormField
      {...props}
      type={visible ? 'text' : 'password'}
      className="pr-10"
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
