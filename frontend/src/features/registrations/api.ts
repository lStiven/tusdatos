import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'
import { myRegistrationsKey } from '@/features/events/api'
import type { Registration } from '@/features/events/rules'

export interface RegistrationFilters {
  status?: Registration['status']
  limit: number
  offset: number
}

export function useMyRegistrations(filters: RegistrationFilters) {
  return useQuery({
    queryKey: [...myRegistrationsKey, filters],
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/users/me/registrations', {
          params: { query: filters },
        }),
      ),
    placeholderData: keepPreviousData,
  })
}
