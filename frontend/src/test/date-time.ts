import { screen, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { es } from '@/i18n/es'

const MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat('es', { month: 'long' }).format(
    new Date(2026, month, 1),
  ),
)

/**
 * Sets a `DateTimeField` as a person would: opens it, moves to the month,
 * clicks the day and picks hour and minute. `value` is `YYYY-MM-DDTHH:mm`.
 */
export async function pickDateTime(
  user: UserEvent,
  label: string,
  value: string,
) {
  const [date = '', time = ''] = value.split('T')
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const [hour = '', minute = ''] = time.split(':')

  await user.click(screen.getByRole('button', { name: label }))
  const picker = within(await screen.findByRole('dialog', { name: label }))
  for (let moves = 0; moves < 120; moves++) {
    const [shownMonth = '', shownYear = ''] =
      picker.getByRole('grid').getAttribute('aria-label')?.split(' ') ?? []
    const distance =
      (year - Number(shownYear)) * 12 + (month - 1 - MONTHS.indexOf(shownMonth))
    if (distance === 0) break
    await user.click(
      picker.getByRole('button', {
        name: distance > 0 ? 'Ir al mes siguiente' : 'Ir al mes anterior',
      }),
    )
  }
  await user.click(
    picker.getByRole('button', {
      name: new RegExp(`\\b${day} de ${MONTHS[month - 1]} de ${year}`),
    }),
  )
  for (const [name, option] of [
    [es.dateTime.hour, hour],
    [es.dateTime.minute, minute],
  ] as const) {
    await user.click(picker.getByRole('combobox', { name }))
    await user.click(await screen.findByRole('option', { name: option }))
  }
  await user.click(picker.getByRole('button', { name: es.dateTime.done }))
}
