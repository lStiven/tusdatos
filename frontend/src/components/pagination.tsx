import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { es } from '@/i18n/es'

/** Previous/next over an API `Page`; hidden when everything fits in one page. */
export function Pagination({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number
  limit: number
  offset: number
  onChange: (offset: number) => void
}) {
  if (total <= limit && offset === 0) return null
  const last = Math.min(offset + limit, total)
  return (
    <nav
      aria-label={es.pagination.label}
      className="mt-8 flex items-center justify-between gap-4"
    >
      <p className="text-sm text-muted-foreground">
        {es.pagination.range(Math.min(offset + 1, total), last, total)}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(offset - limit, 0))}
        >
          <ChevronLeft aria-hidden />
          {es.pagination.previous}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={last >= total}
          onClick={() => onChange(offset + limit)}
        >
          {es.pagination.next}
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
