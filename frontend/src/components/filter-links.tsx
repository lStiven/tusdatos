import { Link } from 'react-router'
import { cn } from '@/lib/utils'

/**
 * Status filters as links, not tabs: each one is a URL that can be shared or
 * bookmarked. Choosing one resets the rest of the query (e.g. the page).
 */
export function FilterLinks<T extends string>({
  label,
  options,
  current,
  param = 'estado',
}: {
  label: string
  options: { value: T | null; label: string }[]
  current: T | null
  param?: string
}) {
  return (
    <nav aria-label={label} className="mb-6">
      <ul className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {options.map((option) => (
          <li key={option.value ?? 'all'}>
            <Link
              to={{ search: option.value ? `?${param}=${option.value}` : '' }}
              aria-current={option.value === current ? 'page' : undefined}
              className={cn(
                'block rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap text-foreground/80 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                option.value === current &&
                  'bg-background text-foreground shadow-sm',
              )}
            >
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
