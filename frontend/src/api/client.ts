import createClient, { type Middleware } from 'openapi-fetch'
import { endSession, getToken } from '@/features/auth/session'
import {
  completeRequest,
  recordRequest,
  redact,
} from '@/features/inspector/store'
import type { paths } from './schema'

async function readBody(message: Request | Response): Promise<string | null> {
  const text = await message.clone().text()
  return text ? redact(text) : null
}

const auth: Middleware = {
  onRequest({ request }) {
    const token = getToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
  onResponse({ request, response }) {
    // A rejected token ends the session; a failed login (no token sent) does not.
    if (response.status === 401 && request.headers.has('Authorization')) {
      endSession('expired')
    }
  },
}

/** Records every call in the request inspector (also used by the lab's client). */
export const inspector: Middleware = {
  async onRequest({ id, request }) {
    const url = new URL(request.url)
    recordRequest({
      id,
      method: request.method,
      path: url.pathname + url.search,
      startedAt: Date.now(),
      durationMs: null,
      status: null,
      code: null,
      requestBody: await readBody(request),
      responseBody: null,
    })
  },
  async onResponse({ id, response }) {
    const body = await readBody(response)
    let code: string | null = null
    if (!response.ok && body) {
      try {
        code = (JSON.parse(body) as { code?: string }).code ?? null
      } catch {
        code = null
      }
    }
    completeRequest(id, { status: response.status, code, responseBody: body })
  },
  onError({ id }) {
    completeRequest(id, {
      status: 0,
      code: 'network_error',
      responseBody: null,
    })
  },
}

// The schema paths already include /api/v1, and the app is served from the API's
// origin (Vite proxy in development, nginx in the image).
export const api = createClient<paths>({
  baseUrl: globalThis.location.origin,
  // Resolved on each call so test doubles and interceptors replace it.
  fetch: (request) => globalThis.fetch(request),
})
api.use(auth, inspector)
