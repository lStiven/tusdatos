import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError, errorMessage, fieldErrors } from '@/api/errors'

/** Business error codes that belong to one form field (e.g. `room_name_taken` → `name`). */
export type CodeFields<T extends FieldValues> = Partial<Record<string, Path<T>>>

/**
 * Puts each API error next to its field: 422 `details` by field name and known
 * business codes through `byCode`. Fields not in the form are ignored.
 */
export function showFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
  byCode: CodeFields<T> = {},
) {
  const field = error instanceof ApiError ? byCode[error.code] : undefined
  if (field) setError(field, { message: errorMessage(error) })
  for (const [name, message] of Object.entries(fieldErrors(error))) {
    if (fields.includes(name)) setError(name as Path<T>, { message })
  }
}

/** What goes above the form: any error not already shown next to a field. */
export function formLevelError<T extends FieldValues>(
  error: ApiError | null,
  byCode: CodeFields<T> = {},
): string | null {
  if (!error || error.status === 422 || byCode[error.code]) return null
  return errorMessage(error)
}
