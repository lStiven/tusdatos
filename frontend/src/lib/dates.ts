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
