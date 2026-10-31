import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { es } from '@/i18n/es'
import { DateTimeField } from './date-time-field'

const t = es.dateTime

function Harness({ initial = '', optional = false }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <DateTimeField
        label="Empieza"
        value={value}
        onChange={setValue}
        optional={optional}
        defaultMonth="2027-03-01T00:00"
      />
      <output aria-label="value">{value || 'empty'}</output>
    </>
  )
}

describe('DateTimeField', () => {
  it('keeps a time chosen before the day', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.getByRole('button', { name: 'Empieza' })).toHaveTextContent(
      t.placeholder,
    )
    await user.click(screen.getByRole('button', { name: 'Empieza' }))
    const picker = within(
      await screen.findByRole('dialog', { name: 'Empieza' }),
    )
    // Opens on `defaultMonth` while empty.
    expect(picker.getByRole('grid')).toHaveAttribute('aria-label', 'marzo 2027')
    await user.click(picker.getByRole('combobox', { name: t.hour }))
    await user.click(await screen.findByRole('option', { name: '18' }))
    expect(screen.getByRole('status', { name: 'value' })).toHaveTextContent(
      'empty',
    )
    await user.click(
      picker.getByRole('button', { name: /\b5 de marzo de 2027/ }),
    )

    expect(screen.getByRole('status', { name: 'value' })).toHaveTextContent(
      '2027-03-05T18:00',
    )
  })

  it('clears an optional value and keeps an odd minute selectable', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2027-03-05T18:07" optional />)

    expect(screen.getByRole('button', { name: 'Empieza' })).toHaveTextContent(
      '5 mar 2027, 18:07',
    )
    await user.click(screen.getByRole('button', { name: 'Empieza' }))
    const picker = within(
      await screen.findByRole('dialog', { name: 'Empieza' }),
    )
    expect(picker.getByRole('combobox', { name: t.minute })).toHaveTextContent(
      '07',
    )
    await user.click(picker.getByRole('button', { name: t.clear }))

    expect(screen.getByRole('status', { name: 'value' })).toHaveTextContent(
      'empty',
    )
  })
})
