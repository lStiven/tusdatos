import { MutationCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError, errorMessage } from '@/api/errors'
import { subscribe as onSessionChange } from '@/features/auth/session'

const MAX_RETRIES = 2

/** Only transient failures are retried: 503 (busy database, lock timeout) and network. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 503 || error.status === 0) &&
    failureCount < MAX_RETRIES
  )
}

/** Waits what `Retry-After` says; otherwise backs off 1 s, 2 s, 4 s… */
export function retryDelay(attempt: number, error: unknown): number {
  if (error instanceof ApiError && error.retryAfter) {
    return error.retryAfter * 1000
  }
  return 1000 * 2 ** attempt
}

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError
    // `silent`: the caller shows the error itself (e.g. next to a form field).
    mutationMeta: { silent?: boolean }
  }
}

export function createQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, retryDelay, staleTime: 15_000 },
      // Writes are not retried on their own: the user decides.
      mutations: { retry: false },
    },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!mutation.meta?.silent) toast.error(errorMessage(error))
      },
    }),
  })
  // Another account must never see the previous one's cached data.
  onSessionChange(() => client.clear())
  return client
}
