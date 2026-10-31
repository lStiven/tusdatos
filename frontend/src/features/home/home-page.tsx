import { Check, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useCurrentUser } from '@/features/auth/api'
import { PageHeader } from '@/components/page-header'
import { RoleBadge } from '@/components/role-badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { es } from '@/i18n/es'
import { can, hasRole, type Action, type User } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { ApiStatus } from './api-status'

const listed: Exclude<Action, 'registration:list'>[] = [
  'event:create',
  'event:manage',
  'speaker:manage',
  'venue:manage',
  'user:manage',
]

function scopeOf(user: User, action: Action) {
  if (action !== 'event:manage') return null
  return hasRole(user, 'ADMIN') ? es.home.all : es.home.ownOnly
}

const cardMotion = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
}

export function HomePage() {
  const { data: user } = useCurrentUser()
  if (!user) return null
  const firstName = user.full_name.split(' ')[0] ?? user.full_name

  return (
    <>
      <PageHeader
        title={es.home.greeting(firstName)}
        description={es.home.subtitle}
      />
      <motion.div
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.08 }}
      >
        <motion.div
          variants={cardMotion}
          className="lg:col-span-2 lg:row-span-2"
        >
          <Card className="h-full shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
            <CardHeader>
              <CardTitle>{es.home.capabilitiesTitle}</CardTitle>
              <CardDescription>{es.home.capabilitiesHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {listed.map((action) => {
                  // Own events stand for "event:manage": admins pass for any.
                  const allowed = can(user, action, { owner_id: user.id })
                  const scope = allowed ? scopeOf(user, action) : null
                  return (
                    <li key={action} className="flex items-center gap-3 py-3">
                      <span
                        className={cn(
                          'grid size-7 shrink-0 place-items-center rounded-full',
                          allowed
                            ? 'bg-success-soft text-success'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {allowed ? (
                          <Check aria-hidden className="size-4" />
                        ) : (
                          <X aria-hidden className="size-4" />
                        )}
                      </span>
                      <span
                        className={cn(
                          'flex-1 text-sm',
                          !allowed && 'text-muted-foreground',
                        )}
                      >
                        {es.home.capabilities[action]}
                        {scope && (
                          <span className="text-muted-foreground">
                            {' '}
                            ({scope})
                          </span>
                        )}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {allowed ? es.home.allowed : es.home.denied}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={cardMotion}>
          <Card className="h-full shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
            <CardHeader>
              <CardTitle>{es.home.rolesTitle}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {user.roles.map((role) => (
                <RoleBadge key={role} role={role} />
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={cardMotion}>
          <Card className="h-full shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
            <CardHeader>
              <CardTitle>{es.home.apiTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <ApiStatus />
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </>
  )
}
