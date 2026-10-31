import { Skeleton } from '@/components/ui/skeleton'

/** While a screen's code downloads (first visit to an organizer or admin page). */
export function RouteLoading() {
  return (
    <div aria-busy className="space-y-6 p-6">
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="h-40" />
    </div>
  )
}
