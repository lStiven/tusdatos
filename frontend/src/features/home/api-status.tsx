import { useQuery } from '@tanstack/react-query'
import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'
import { es } from '@/i18n/es'

export function ApiStatus() {
  const { data, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: () => unwrap(api.GET('/health')),
    retry: false,
  })

  const [Icon, text, tone] = isPending
    ? [LoaderCircle, es.health.checking, 'text-muted-foreground']
    : data?.status === 'ok'
      ? [CircleCheck, es.health.ok, 'text-success']
      : [CircleX, es.health.down, 'text-destructive']

  return (
    <output
      aria-live="polite"
      className={`flex items-center gap-2 text-sm ${tone}`}
    >
      <Icon
        aria-hidden
        className={`size-4 shrink-0 ${isPending ? 'animate-spin' : ''}`}
      />
      {text}
    </output>
  )
}
