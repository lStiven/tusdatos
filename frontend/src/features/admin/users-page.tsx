import { CloudOff, UserX } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/api/errors'
import { ConfirmSwitch } from '@/components/confirm-switch'
import { FilterLinks } from '@/components/filter-links'
import { PageHeader } from '@/components/page-header'
import { Pagination } from '@/components/pagination'
import { RoleBadge } from '@/components/role-badge'
import { SearchInput } from '@/components/search-input'
import { StatePanel } from '@/components/state-panel'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/auth/api'
import { es } from '@/i18n/es'
import type { Role, User } from '@/lib/permissions'
import { useListParams } from '@/lib/use-list-params'
import { useSetRole, useUsers, type AssignableRole } from './api'

const PAGE_SIZE = 20
const t = es.users
const assignable: AssignableRole[] = ['ORGANIZER', 'ADMIN']
// A variable, not a literal: jsx-a11y reads `role="…"` as an ARIA role.
const ATTENDEE: Role = 'ATTENDEE'
const list = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

export function UsersPage() {
  const { data: me } = useCurrentUser()
  const { params, setParams, status, offset, setOffset } = useListParams(
    assignable,
    'rol',
  )
  const email = params.get('q') ?? ''
  const { data, error, isPending, isError, refetch } = useUsers({
    email: email || undefined,
    role: status ?? undefined,
    limit: PAGE_SIZE,
    offset,
  })

  const setEmail = useCallback(
    (value: string) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (value.trim()) next.set('q', value.trim())
          else next.delete('q')
          next.delete('desde')
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  return (
    <>
      <PageHeader title={t.title} description={t.subtitle} />
      <div className="mb-2 sm:max-w-xs">
        <SearchInput
          value={email}
          onChange={setEmail}
          label={t.search}
          placeholder={t.searchPlaceholder}
        />
      </div>
      <div className="mt-4">
        <FilterLinks
          label={t.filterLabel}
          param="rol"
          current={status}
          options={[
            { value: null, label: t.all },
            ...assignable.map((role) => ({
              value: role,
              label: es.roles[role],
            })),
          ]}
        />
      </div>

      {isPending ? (
        <div aria-busy className="space-y-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : isError ? (
        <StatePanel
          icon={CloudOff}
          title={t.loadError}
          description={errorMessage(error)}
          action={{ label: t.retry, onClick: () => void refetch() }}
          heading="h2"
        />
      ) : data.items.length === 0 ? (
        <StatePanel
          icon={UserX}
          title={t.emptyTitle}
          description={t.emptyDescription}
          heading="h2"
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {t.lastAdminHint}
          </p>
          <motion.ul
            key={`${email}|${status}|${offset}`}
            className="space-y-3"
            variants={list}
            initial="hidden"
            animate="show"
          >
            {data.items.map((user) => (
              <motion.li key={user.id} variants={item}>
                <UserRow user={user} isMe={user.id === me?.id} />
              </motion.li>
            ))}
          </motion.ul>
          <Pagination
            total={data.total}
            limit={PAGE_SIZE}
            offset={offset}
            onChange={setOffset}
          />
        </>
      )}
    </>
  )
}

function UserRow({ user, isMe }: { user: User; isMe: boolean }) {
  return (
    <Card className="flex-row flex-wrap items-center gap-x-6 gap-y-3 p-4 shadow-sm">
      <div className="min-w-0 flex-1 basis-56 space-y-1">
        <h2 className="flex flex-wrap items-center gap-2 font-semibold">
          {user.full_name}
          {isMe && <Badge variant="outline">{t.you}</Badge>}
          {!user.is_active && (
            <Badge variant="outline" className="text-muted-foreground">
              {t.inactive}
            </Badge>
          )}
        </h2>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span title={t.attendeeFixed}>
          <RoleBadge role={ATTENDEE} />
        </span>
        {assignable.map((role) => (
          <RoleSwitch key={role} user={user} role={role} isMe={isMe} />
        ))}
      </div>
    </Card>
  )
}

function RoleSwitch({
  user,
  role,
  isMe,
}: {
  user: User
  role: AssignableRole
  isMe: boolean
}) {
  const setRole = useSetRole()
  const roleName = es.roles[role]

  function change(granted: boolean) {
    setRole.mutate(
      { userId: user.id, role, granted },
      {
        onSuccess: () =>
          toast.success(
            (granted ? t.granted : t.revoked)(
              roleName.toLowerCase(),
              user.full_name,
            ),
          ),
      },
    )
  }

  return (
    <ConfirmSwitch
      checked={user.roles.includes(role)}
      label={roleName}
      ariaLabel={t.roleSwitch(roleName, user.full_name)}
      disabled={setRole.isPending}
      onChange={change}
      confirmOff={{
        title: t.revokeDialog.title(roleName.toLowerCase(), user.full_name),
        description:
          isMe && role === 'ADMIN'
            ? `${t.revokeDialog[role]} ${t.revokeDialog.self}`
            : t.revokeDialog[role],
        confirmLabel: t.revokeDialog.confirm,
        cancelLabel: t.revokeDialog.keep,
      }}
    />
  )
}
