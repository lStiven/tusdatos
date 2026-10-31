import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'
import type { components } from '@/api/schema'
import { eventKeys, type EventFilters } from '@/features/events/api'
import type { Registration } from '@/features/events/rules'

type Schemas = components['schemas']
export type EventInput = Schemas['EventCreate']
export type SessionInput = Schemas['SessionCreate']

export function useMyEvents(filters: Omit<EventFilters, 'title'>) {
  return useQuery({
    queryKey: eventKeys.list({ ...filters, mine: true }),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/events', {
          params: { query: { ...filters, mine: true } },
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

export function useActiveVenues() {
  return useQuery({
    queryKey: ['venues', 'active'],
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/venues', { params: { query: { is_active: true } } }),
      ),
    staleTime: 60_000,
  })
}

export function useRooms(venueId: number | null) {
  return useQuery({
    queryKey: ['venues', venueId, 'rooms'],
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/venues/{venue_id}/rooms', {
          params: { path: { venue_id: venueId ?? 0 } },
        }),
      ),
    enabled: venueId !== null,
  })
}

export function useEventRegistrations(
  id: number,
  filters: { status?: Registration['status']; limit: number; offset: number },
) {
  return useQuery({
    queryKey: [...eventKeys.detail(id), 'registrations', filters],
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/events/{event_id}/registrations', {
          params: { path: { event_id: id }, query: filters },
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

/** Any change to an event can move seats, sessions or lists: refresh them all. */
function useRefreshEvents() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['events'] })
}

export function useSaveEvent(id?: number) {
  const refresh = useRefreshEvents()
  return useMutation({
    mutationFn: (body: EventInput) =>
      unwrap(
        id === undefined
          ? api.POST('/api/v1/events', { body })
          : api.PATCH('/api/v1/events/{event_id}', {
              params: { path: { event_id: id } },
              body,
            }),
      ),
    onSuccess: refresh,
    // The form shows the error next to the field or above it.
    meta: { silent: true },
  })
}

export type Transition = 'publish' | 'complete' | 'cancel'

export function useEventTransition(id: number) {
  const refresh = useRefreshEvents()
  return useMutation({
    mutationFn: (transition: Transition) => {
      const params = { params: { path: { event_id: id } } }
      switch (transition) {
        case 'publish':
          return unwrap(api.POST('/api/v1/events/{event_id}/publish', params))
        case 'complete':
          return unwrap(api.POST('/api/v1/events/{event_id}/complete', params))
        case 'cancel':
          return unwrap(api.POST('/api/v1/events/{event_id}/cancel', params))
      }
    },
    onSettled: refresh,
  })
}

export function useSaveSession(eventId: number, sessionId?: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: SessionInput) =>
      unwrap(
        sessionId === undefined
          ? api.POST('/api/v1/events/{event_id}/sessions', {
              params: { path: { event_id: eventId } },
              body,
            })
          : api.PATCH('/api/v1/sessions/{session_id}', {
              params: { path: { session_id: sessionId } },
              body,
            }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: eventKeys.sessions(eventId) }),
    meta: { silent: true },
  })
}

export type SessionAction = 'schedule' | 'unschedule' | 'cancel'

export function useSessionAction(eventId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: SessionAction }) => {
      const params = { params: { path: { session_id: id } } }
      switch (action) {
        case 'schedule':
          return unwrap(
            api.POST('/api/v1/sessions/{session_id}/schedule', params),
          )
        case 'unschedule':
          return unwrap(
            api.POST('/api/v1/sessions/{session_id}/unschedule', params),
          )
        case 'cancel':
          return unwrap(
            api.POST('/api/v1/sessions/{session_id}/cancel', params),
          )
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: eventKeys.sessions(eventId) }),
  })
}
