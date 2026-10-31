import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'
import type { components } from '@/api/schema'
import { meQueryKey } from '@/features/auth/api'
import type { Role } from '@/lib/permissions'

type Schemas = components['schemas']
export type AssignableRole = Schemas['AssignableRole']
export type Venue = Schemas['VenueRead']
export type Room = Schemas['RoomRead']

export function useUsers(filters: {
  email?: string
  role?: Role
  limit: number
  offset: number
}) {
  return useQuery({
    queryKey: ['users', 'list', filters],
    queryFn: () =>
      unwrap(api.GET('/api/v1/users', { params: { query: filters } })),
    placeholderData: keepPreviousData,
  })
}

export function useSetRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      userId,
      role,
      granted,
    }: {
      userId: number
      role: AssignableRole
      granted: boolean
    }) => {
      const params = { params: { path: { user_id: userId, role } } }
      return unwrap(
        granted
          ? api.PUT('/api/v1/users/{user_id}/roles/{role}', params)
          : api.DELETE('/api/v1/users/{user_id}/roles/{role}', params),
      )
    },
    // Also `me`: changing your own roles changes what the UI offers you.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['users', 'list'] }),
        queryClient.invalidateQueries({ queryKey: meQueryKey, exact: true }),
      ]),
  })
}

export function useVenues(isActive?: boolean) {
  return useQuery({
    queryKey: ['venues', 'list', isActive ?? null],
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/venues', {
          params: { query: { is_active: isActive ?? null } },
        }),
      ),
  })
}

/** Venues feed event forms and agendas too: refresh everything about them. */
function useRefreshVenues() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['venues'] })
}

export function useSaveVenue(id?: number) {
  const refresh = useRefreshVenues()
  return useMutation({
    mutationFn: (body: Schemas['VenueCreate']) =>
      unwrap(
        id === undefined
          ? api.POST('/api/v1/venues', { body })
          : api.PATCH('/api/v1/venues/{venue_id}', {
              params: { path: { venue_id: id } },
              body,
            }),
      ),
    onSuccess: refresh,
    // Form saves show their errors inline; switches rely on the global toast.
    meta: { silent: true },
  })
}

export function useSetVenueActive() {
  const refresh = useRefreshVenues()
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      unwrap(
        api.PATCH('/api/v1/venues/{venue_id}', {
          params: { path: { venue_id: id } },
          body: { is_active: active },
        }),
      ),
    onSettled: refresh,
  })
}

export function useSaveRoom(venueId: number, roomId?: number) {
  const refresh = useRefreshVenues()
  return useMutation({
    mutationFn: (body: Schemas['RoomCreate']) =>
      unwrap(
        roomId === undefined
          ? api.POST('/api/v1/venues/{venue_id}/rooms', {
              params: { path: { venue_id: venueId } },
              body,
            })
          : api.PATCH('/api/v1/venues/{venue_id}/rooms/{room_id}', {
              params: { path: { venue_id: venueId, room_id: roomId } },
              body,
            }),
      ),
    onSuccess: refresh,
    meta: { silent: true },
  })
}

export function useSetRoomActive(venueId: number) {
  const refresh = useRefreshVenues()
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      unwrap(
        api.PATCH('/api/v1/venues/{venue_id}/rooms/{room_id}', {
          params: { path: { venue_id: venueId, room_id: id } },
          body: { is_active: active },
        }),
      ),
    onSettled: refresh,
  })
}
