import type { UseFormSetError } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { es } from '@/i18n/es'
import { formLevelError, showFieldErrors } from './form-errors'

type Values = { name: string }

const taken = new ApiError(409, 'room_name_taken', 'Taken')
const invalid = new ApiError(422, 'validation_error', 'Invalid', [
  { field: 'body.name', message: 'Too long', type: 'string_too_long' },
  { field: 'body.unknown', message: 'Ignored', type: 'extra' },
])
const other = new ApiError(503, 'service_unavailable', 'Busy')

describe('form errors', () => {
  it('puts known codes and 422 details next to their fields only', () => {
    const setError = vi.fn<UseFormSetError<Values>>()
    showFieldErrors<Values>(taken, setError, ['name'], {
      room_name_taken: 'name',
    })
    showFieldErrors<Values>(invalid, setError, ['name'])
    showFieldErrors<Values>(other, setError, ['name'])

    expect(setError.mock.calls).toEqual([
      ['name', { message: es.errors.byCode.room_name_taken }],
      ['name', { message: 'Too long' }],
    ])
  })

  it.each([
    ['no error', null, null],
    ['a field error', taken, null],
    ['a 422', invalid, null],
    ['any other error', other, es.errors.byCode.service_unavailable],
  ])('shows above the form for %s: %s', (_, error, expected) => {
    expect(formLevelError(error, { room_name_taken: 'name' })).toBe(expected)
  })
})
