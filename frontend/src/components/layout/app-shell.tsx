import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Menu, ServerCrash } from 'lucide-react'
import { motion } from 'motion/react'
import { errorMessage } from '@/api/errors'
import { useCurrentUser } from '@/features/auth/api'
import { InspectorPanel } from '@/features/inspector/inspector-panel'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { StatePanel } from '@/components/state-panel'
import { es } from '@/i18n/es'
import { labEnabled } from '@/lib/env'
import { Brand } from './brand'
import { navFor } from './nav'
import { NavList } from './nav-list'
import { ThemeMenu } from './theme-menu'
import { UserMenu } from './user-menu'

function ShellSkeleton() {
  return (
    <div aria-busy="true" className="flex min-h-svh">
      <div className="hidden w-64 flex-col gap-3 border-r p-4 lg:flex">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
      <div className="flex-1 space-y-4 p-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}

export function AppShell() {
  const { data: user, error, refetch } = useCurrentUser()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  // Move focus to the new page so keyboard and screen reader users start there.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    mainRef.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  }, [pathname])

  if (error) {
    return (
      <div className="grid min-h-svh place-items-center p-6">
        <StatePanel
          icon={ServerCrash}
          title={es.loadError.title}
          description={errorMessage(error)}
          action={{ label: es.loadError.retry, onClick: () => void refetch() }}
        />
      </div>
    )
  }
  if (!user) return <ShellSkeleton />

  const sections = navFor(user, labEnabled)

  return (
    <div className="min-h-svh bg-background">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {es.a11y.skipToContent}
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-16 items-center px-5">
          <Brand />
        </div>
        <nav
          aria-label={es.a11y.mainNav}
          className="flex-1 overflow-y-auto px-3 py-4"
        >
          <NavList sections={sections} />
        </nav>
      </aside>

      <div className="relative lg:pl-64">
        {/* Soft brand glow behind the page header; purely decorative. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
        />
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label={es.a11y.openMenu}
              >
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar">
              <SheetHeader>
                <SheetTitle asChild>
                  <div>
                    <Brand />
                  </div>
                </SheetTitle>
                <SheetDescription className="sr-only">
                  {es.a11y.mainNav}
                </SheetDescription>
              </SheetHeader>
              <nav aria-label={es.a11y.mainNav} className="px-3">
                <NavList
                  sections={sections}
                  onNavigate={() => setMenuOpen(false)}
                />
              </nav>
            </SheetContent>
          </Sheet>
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <InspectorPanel />
            <ThemeMenu />
            <UserMenu user={user} />
          </div>
        </header>

        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          className="relative mx-auto w-full max-w-6xl px-4 py-8 outline-none sm:px-6 lg:px-8"
        >
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
