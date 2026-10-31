import type { ReactNode } from 'react'
import { CalendarCheck, ShieldCheck, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { Brand } from '@/components/layout/brand'
import { ThemeMenu } from '@/components/layout/theme-menu'
import { es } from '@/i18n/es'
import { usePageTitle } from '@/lib/use-page-title'

const featureIcons = [Users, CalendarCheck, ShieldCheck]

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  usePageTitle(title)
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-linear-to-br from-primary via-violet-600 to-fuchsia-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Decorative blobs: slow drift, removed when reduced motion is on. */}
        <motion.div
          aria-hidden
          className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl"
          animate={{ y: [0, 24, 0], x: [0, -16, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="absolute -bottom-32 -left-16 size-96 rounded-full bg-fuchsia-300/20 blur-3xl"
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative [&_a]:text-white">
          <Brand />
        </div>
        <div className="relative space-y-8">
          <h2 className="max-w-md font-heading text-4xl leading-tight font-semibold">
            {es.app.tagline}
          </h2>
          <motion.ul
            className="space-y-4"
            initial="hidden"
            animate="show"
            transition={{ staggerChildren: 0.12, delayChildren: 0.2 }}
          >
            {es.auth.features.map((feature, index) => {
              const Icon = featureIcons[index] ?? Users
              return (
                <motion.li
                  key={feature}
                  variants={{
                    hidden: { opacity: 0, x: -12 },
                    show: { opacity: 1, x: 0 },
                  }}
                  className="flex items-center gap-3 text-white/90"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-white/15 shadow-lg backdrop-blur">
                    <Icon aria-hidden className="size-4.5" />
                  </span>
                  {feature}
                </motion.li>
              )
            })}
          </motion.ul>
        </div>
        <p className="relative text-sm text-white/70">
          FastAPI · PostgreSQL · React
        </p>
      </aside>

      <main className="relative flex flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <ThemeMenu />
        </div>
        <div className="mb-8 lg:hidden">
          <Brand />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-sm space-y-6"
        >
          <div className="space-y-1.5">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </motion.div>
      </main>
    </div>
  )
}
