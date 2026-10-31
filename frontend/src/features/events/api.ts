import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/api/client'
import { ApiError, unwrap } from '@/api/errors'
import type { Event, Session } from './rules'

export interface EventFilters {
  title?: string
  status?: Event['status']
  mine?: boolean
  limit: number
  offset: number
}

export const eventKeys = {
  list: (filters: EventFilters) => ['events', 'list', filters] as const,
  detail: (id: number) => ['events', id] as const,
  occupancy: (id: number) => ['events', id, 'occupancy'] as const,
  registration: (id: number) => ['events', id, 'registration'] as const,
  sessions: (id: number) => ['events', id, 'sessions'] as const,
}

export const myRegistrationsKey = ['users', 'me', 'registrations'] as const

export function useEvents(filters: EventFilters) {
  return useQuery({
    queryKey: eventKeys.list(filters),
    queryFn: () =>
      unwrap(api.GET('/api/v1/events', { params: { query: filters } })),
    // Keeps the current page visible while the next one loads.
    placeholderData: keepPreviousData,
  })
}

const path = (id: number) => ({ params: { path: { event_id: id } } })

export function useEvent(id: number) {
  return useQuery({
    queryKey: eventKeys.detail(id),
    queryFn: () => unwrap(api.GET('/api/v1/events/{event_id}', path(id))),
  })
}

export function useOccupancy(id: number, enabled = true) {
  return useQuery({
    queryKey: eventKeys.occupancy(id),
    queryFn: () =>
      unwrap(api.GET('/api/v1/events/{event_id}/occupancy', path(id))),
    enabled,
  })
}

/** The user's registration for the event, in any status; `null` if never registered. */
export function useMyRegistration(id: number) {
  return useQuery({
    queryKey: eventKeys.registration(id),
    queryFn: async () => {
      try {
        return await unwrap(
          api.GET('/api/v1/events/{event_id}/registrations/me', path(id)),
        )
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.code === 'registration_not_found'
        ) {
          return null
        }
        throw error
      }
    },
  })
}

export function useSessions(id: number, enabled = true) {
  return useQuery({
    queryKey: eventKeys.sessions(id),
    queryFn: () =>
      unwrap(api.GET('/api/v1/events/{event_id}/sessions', path(id))),
    enabled,
  })
}

export function useVenue(id: number | null) {
  return useQuery({
    queryKey: ['venues', id],
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/venues/{venue_id}', {
          params: { path: { venue_id: id ?? 0 } },
        }),
      ),
    enabled: id !== null,
  })
}

/** Registration changes move seats: refresh the event, its queue and my list. */
function useRefreshRegistration(id: number) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(id) }),
      queryClient.invalidateQueries({ queryKey: myRegistrationsKey }),
    ])
}

export function useRegisterForEvent(id: number) {
  const refresh = useRefreshRegistration(id)
  return useMutation({
    // Never optimistic: whether it is CONFIRMED or WAITLISTED is the server's call.
    mutationFn: async () => {
      const request = api.POST(
        '/api/v1/events/{event_id}/registrations',
        path(id),
      )
      const registration = await unwrap(request)
      // 201: new or reactivated; 200: already registered, unchanged.
      return { registration, created: (await request).response.status === 201 }
    },
    onSettled: refresh,
  })
}

export function useCancelRegistration(id: number) {
  const refresh = useRefreshRegistration(id)
  return useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/api/v1/events/{event_id}/registrations/me/cancel', path(id)),
      ),
    onSettled: refresh,
  })
}

/** Marks or withdraws interest; optimistic, since it reserves nothing. */
export function useToggleInterest(eventId: number) {
  const queryClient = useQueryClient()
  const key = eventKeys.sessions(eventId)
  return useMutation({
    mutationFn: ({ session, interested }: InterestChange) => {
      const params = { params: { path: { session_id: session.id } } }
      return unwrap(
        interested
          ? api.PUT('/api/v1/sessions/{session_id}/interest', params)
          : api.DELETE('/api/v1/sessions/{session_id}/interest', params),
      )
    },
    onMutate: async ({ session, interested }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Session[]>(key)
      queryClient.setQueryData<Session[]>(key, (sessions) =>
        sessions?.map((item) =>
          item.id === session.id
            ? {
                ...item,
                is_interested: interested,
                interested: item.interested + (interested ? 1 : -1),
              }
            : item,
        ),
      )
      return { previous }
    },
    onError: (_error, _change, context) => {
      queryClient.setQueryData(key, context?.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export interface InterestChange {
  session: Session
  interested: boolean
}
