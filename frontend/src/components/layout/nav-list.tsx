import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'
import type { navFor } from './nav'

interface NavListProps {
  sections: ReturnType<typeof navFor>
  onNavigate?: () => void
}

export function NavList({ sections, onNavigate }: NavListProps) {
  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <div key={section.label} className="flex flex-col gap-1">
          <h2 className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {section.label}
          </h2>
          <ul className="flex flex-col gap-0.5">
            {section.items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-xs'
                        : 'text-sidebar-foreground/80 hover:translate-x-0.5 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                    )
                  }
                >
                  <Icon
                    aria-hidden
                    className="size-4 shrink-0 transition-transform duration-200 group-hover:scale-110"
                  />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
