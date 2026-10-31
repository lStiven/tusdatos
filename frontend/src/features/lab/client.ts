import createClient from 'openapi-fetch'
import { inspector } from '@/api/client'
import type { paths } from '@/api/schema'

/**
 * The lab acts as several accounts at once, each with its own token: it never
 * reads or writes the tab's session. Its calls still show in the inspector.
 */
export const labApi = createClient<paths>({
  baseUrl: globalThis.location.origin,
  fetch: (request) => globalThis.fetch(request),
})
labApi.use(inspector)

export const bearer = (token: string) => ({
  Authorization: `Bearer ${token}`,
})

/** What a call answered, without throwing: the lab compares it with what it expects. */
export interface Reply<T> {
  status: number
  code: string | null
  data: T | undefined
}

interface Result<T> {
  data?: T
  error?: unknown
  response: Response
}

export async function send<T>(request: Promise<Result<T>>): Promise<Reply<T>> {
  try {
    const { data, error, response } = await request
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : null
    return { status: response.status, code, data }
  } catch {
    return { status: 0, code: 'network_error', data: undefined }
  }
}

/** «201», «409 registration_closed»: how a reply reads in the results. */
export function describeReply(reply: Reply<unknown>) {
  return reply.code ? `${reply.status} ${reply.code}` : String(reply.status)
}
