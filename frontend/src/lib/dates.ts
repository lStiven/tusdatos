// The API answers in UTC; each event says in which IANA time zone to show its times.

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions) {
  const key = timeZone + JSON.stringify(options)
  let format = formatters.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat('es', { timeZone, ...options })
    formatters.set(key, format)
  }
  return format
}

/** «14 nov 2026, 9:00». */
export function formatDateTime(iso: string, timeZone: string) {
  return formatter(timeZone, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

/** «9:00». */
export function formatTime(iso: string, timeZone: string) {
  return formatter(timeZone, { timeStyle: 'short' }).format(new Date(iso))
}

/** «sábado, 14 de noviembre». */
export function formatDay(iso: string, timeZone: string) {
  return formatter(timeZone, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso))
}

/** «14 nov 2026, 9:00–18:00», or both dates when the range spans days. */
export function formatRange(start: string, end: string, timeZone: string) {
  return formatter(timeZone, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).formatRange(new Date(start), new Date(end))
}

type Parts = Record<Intl.DateTimeFormatPartTypes, string>

function partsOf(
  iso: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
) {
  const parts = formatter(timeZone, options).formatToParts(new Date(iso))
  return Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  ) as Parts
}

/** Calendar tile: short month and day of the month («nov», «14»). */
export function dateTile(iso: string, timeZone: string) {
  const { month, day } = partsOf(iso, timeZone, {
    month: 'short',
    day: 'numeric',
  })
  return { month: month.replace('.', ''), day }
}

/** `YYYY-MM-DD` in the given zone, to group times by local day. */
export function dayKey(iso: string, timeZone: string) {
  const { year, month, day } = partsOf(iso, timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return `${year}-${month}-${day}`
}

const pad = (value: number) => String(value).padStart(2, '0')

const wallClock: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}

/** Minutes `timeZone` is ahead of UTC at the instant `utc` (ms). */
function offsetMinutes(utc: number, timeZone: string) {
  const { year, month, day, hour, minute } = partsOf(
    new Date(utc).toISOString(),
    timeZone,
    wallClock,
  )
  const wall = Date.UTC(+year, +month - 1, +day, +hour, +minute)
  return Math.round((wall - Math.floor(utc / 60_000) * 60_000) / 60_000)
}

/** UTC instant → `YYYY-MM-DDTHH:mm` in the zone, for `<input type="datetime-local">`. */
export function toZonedInput(iso: string, timeZone: string) {
  const { year, month, day, hour, minute } = partsOf(iso, timeZone, wallClock)
  return `${year}-${month}-${day}T${hour}:${minute}`
}

/**
 * Wall time typed for the event's zone → ISO with that zone's offset
 * («2026-11-28T09:00» in Bogotá → «2026-11-28T09:00:00-05:00»).
 */
export function fromZonedInput(local: string, timeZone: string) {
  const [date = '', time = ''] = local.split('T')
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const [hour = 0, minute = 0] = time.split(':').map(Number)
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  // Second pass: the offset may differ at the real instant (daylight saving).
  const guess = offsetMinutes(wall, timeZone)
  const offset = offsetMinutes(wall - guess * 60_000, timeZone)
  const sign = offset < 0 ? '-' : '+'
  const abs = Math.abs(offset)
  return `${date}T${pad(hour)}:${pad(minute)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/** Whether the IANA name is known to the browser (e.g. «America/Bogota»). */
export function isTimeZone(name: string) {
  try {
    new Intl.DateTimeFormat('es', { timeZone: name })
    return true
  } catch {
    return false
  }
}
