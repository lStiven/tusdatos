import { CalendarHeart } from 'lucide-react'
import { Link } from 'react-router'
import { es } from '@/i18n/es'

export function Brand() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2.5 rounded-lg font-heading text-base font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="grid size-8 place-items-center rounded-lg bg-linear-to-br from-primary to-fuchsia-500 text-primary-foreground shadow-md shadow-primary/25">
        <CalendarHeart aria-hidden className="size-4.5" />
      </span>
      {es.app.name}
    </Link>
  )
}
