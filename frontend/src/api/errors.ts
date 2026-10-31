import { es } from '@/i18n/es'

export interface FieldError {
  field: string
  message: string
  type: string
}

/** Error contract of the API: `{code, message, details}` (see `/docs`). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: FieldError[]
  /** Seconds to wait before retrying, from `Retry-After` (503 only). */
  readonly retryAfter: number | null

  constructor(
    status: number,
    code: string,
    message: string,
    details: FieldError[] = [],
    retryAfter: number | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.retryAfter = retryAfter
  }
}

interface ErrorBody {
  code?: string
  message?: string
  details?: FieldError[] | null
}

interface Result {
  data?: unknown
  error?: unknown
  response: Response
}

/** Data type of the success branch of an openapi-fetch result. */
type DataOf<R> = R extends { data: infer D; error?: never } ? D : never

/** Resolves to the response data or throws an `ApiError`, also on network failures. */
export async function unwrap<R extends Result>(
  request: Promise<R>,
): Promise<DataOf<R>> {
  let result: R
  try {
    result = await request
  } catch {
    throw new ApiError(0, 'network_error', 'Network error')
  }
  if (result.error === undefined) return result.data as DataOf<R>

  const { response } = result
  const body = (result.error ?? {}) as ErrorBody
  const retryAfter = Number(response.headers.get('Retry-After'))
  throw new ApiError(
    response.status,
    body.code ?? `http_${response.status}`,
    body.message ?? response.statusText,
    body.details ?? [],
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
  )
}

const messages: Partial<Record<string, string>> = es.errors.byCode

/** User-facing text for any error: the API `code` in Spanish, else the API message. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return es.errors.unexpected
  if (error.code === 'service_unavailable' && error.retryAfter) {
    return es.errors.retryIn(error.retryAfter)
  }
  return messages[error.code] ?? error.message ?? es.errors.unexpected
}

/** Maps 422 `details` (`body.email`) to form fields (`email`). */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.status !== 422) return {}
  return Object.fromEntries(
    error.details.map((detail) => [
      detail.field.split('.').at(-1) ?? detail.field,
      detail.message,
    ]),
  )
}
