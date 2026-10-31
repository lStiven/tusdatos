import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { es as calendarEs } from 'react-day-picker/locale'
import { Field } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { es } from '@/i18n/es'
import { formatWallTime, parseWallTime } from '@/lib/dates'
import { cn } from '@/lib/utils'

const pad = (value: number) => String(value).padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, hour) => pad(hour))
const MINUTES = Array.from({ length: 12 }, (_, step) => pad(step * 5))
const DEFAULT_TIME = '09:00'

/** «1 jul 2027, 9:00»: the wall time as typed, with no zone conversion. */
function display(value: string) {
  const parts = parseWallTime(value)
  if (!parts) return null
  const [hour, minute] = parts.time.split(':').map(Number) as [number, number]
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(
    Date.UTC(
      parts.date.getFullYear(),
      parts.date.getMonth(),
      parts.date.getDate(),
      hour,
      minute,
    ),
  )
}

/**
 * Date and time picker styled like the app (the native one follows the
 * operating system). The value is `YYYY-MM-DDTHH:mm`, or `''` when empty.
 */
export function DateTimeField({
  label,
  hint,
  error,
  value,
  onChange,
  onBlur,
  optional = false,
  defaultMonth,
}: {
  label: string
  hint?: string
  error?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  /** Offers to clear the value. */
  optional?: boolean
  /** Month shown while empty (e.g. the event's). */
  defaultMonth?: string
}) {
  const t = es.dateTime
  const [open, setOpen] = useState(false)
  // Chosen before the day: kept until a day completes the value.
  const [pendingTime, setPendingTime] = useState(DEFAULT_TIME)
  const parts = parseWallTime(value)
  const time = parts?.time ?? pendingTime
  const [hour, minute] = time.split(':') as [string, string]
  // An odd minute from the API stays selectable.
  const minutes = MINUTES.includes(minute)
    ? MINUTES
    : [...MINUTES, minute].sort()

  function setTime(next: string) {
    if (parts) onChange(formatWallTime({ date: parts.date, time: next }))
    else setPendingTime(next)
  }

  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => (
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (!next) onBlur?.()
          }}
        >
          <PopoverTrigger asChild>
            <Button
              {...control}
              type="button"
              variant="outline"
              className={cn(
                'h-10 w-full justify-start gap-2 bg-background px-2.5 font-normal',
                !parts && 'text-muted-foreground',
              )}
            >
              <CalendarDays aria-hidden className="text-muted-foreground" />
              {display(value) ?? t.placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            aria-label={label}
            align="start"
            className="w-auto p-0"
          >
            <Calendar
              mode="single"
              locale={calendarEs}
              selected={parts?.date}
              defaultMonth={
                parts?.date ?? parseWallTime(defaultMonth ?? '')?.date
              }
              onSelect={(day) =>
                day && onChange(formatWallTime({ date: day, time }))
              }
              showOutsideDays={false}
            />
            <div className="flex items-center gap-2 border-t p-3">
              <span className="text-sm text-muted-foreground">{t.time}</span>
              <Select
                value={hour}
                onValueChange={(next) => setTime(`${next}:${minute}`)}
              >
                <SelectTrigger aria-label={t.hour} className="w-18">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-60">
                  {HOURS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span aria-hidden>:</span>
              <Select
                value={minute}
                onValueChange={(next) => setTime(`${hour}:${next}`)}
              >
                <SelectTrigger aria-label={t.minute} className="w-18">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-60">
                  {minutes.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 border-t p-3">
              {optional && parts && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onChange('')
                    setOpen(false)
                  }}
                >
                  {t.clear}
                </Button>
              )}
              <Button type="button" size="sm" onClick={() => setOpen(false)}>
                {t.done}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </Field>
  )
}
