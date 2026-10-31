import { LogOut } from 'lucide-react'
import { endSession } from '@/features/auth/session'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RoleBadge } from '@/components/role-badge'
import { es } from '@/i18n/es'
import type { User } from '@/lib/permissions'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
}

export function UserMenu({ user }: { user: User }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2 px-1.5"
          aria-label={es.userMenu.label}
        >
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
              {initials(user.full_name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate text-sm sm:inline">
            {user.full_name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">
            {user.full_name}
          </span>
          <span className="truncate text-xs font-normal">{user.email}</span>
          <span className="flex flex-wrap gap-1">
            {user.roles.map((role) => (
              <RoleBadge key={role} role={role} />
            ))}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => endSession('logout')}>
          <LogOut aria-hidden />
          {es.userMenu.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
