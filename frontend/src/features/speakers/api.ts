import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'
import type { components } from '@/api/schema'

export type Speaker = components['schemas']['SpeakerRead']
export type SpeakerInput = components['schemas']['SpeakerCreate']

export function useSpeakers(filters: {
  name?: string
  limit: number
  offset: number
}) {
  return useQuery({
    queryKey: ['speakers', filters],
    queryFn: () =>
      unwrap(api.GET('/api/v1/speakers', { params: { query: filters } })),
    placeholderData: keepPreviousData,
  })
}

export function useSaveSpeaker(id?: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: SpeakerInput) =>
      unwrap(
        id === undefined
          ? api.POST('/api/v1/speakers', { body })
          : api.PATCH('/api/v1/speakers/{speaker_id}', {
              params: { path: { speaker_id: id } },
              body,
            }),
      ),
    // Speakers show inside sessions too.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['speakers'] }),
        queryClient.invalidateQueries({ queryKey: ['events'] }),
      ]),
    meta: { silent: true },
  })
}

export function useDeleteSpeaker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      unwrap(
        api.DELETE('/api/v1/speakers/{speaker_id}', {
          params: { path: { speaker_id: id } },
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['speakers'] }),
  })
}
