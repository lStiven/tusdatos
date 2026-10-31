import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'

interface StatePanelProps {
  icon: LucideIcon
  title: string
  description: string
  action?:
    { label: string; to: string } | { label: string; onClick: () => void }
  /** `h2` when the page already has its own `h1`. */
  heading?: 'h1' | 'h2'
}

/** Empty, error and permission states: what happened and what to do next. */
export function StatePanel({
  icon: Icon,
  title,
  description,
  action,
  heading: Heading = 'h1',
}: StatePanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-dashed bg-card/60 px-6 py-12 text-center"
    >
      <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
        <Icon aria-hidden className="size-6" />
      </span>
      <Heading className="font-heading text-lg font-semibold">{title}</Heading>
      <p className="text-sm text-muted-foreground">{description}</p>
      {action &&
        ('to' in action ? (
          <Button asChild variant="outline" className="mt-2">
            <Link to={action.to}>{action.label}</Link>
          </Button>
        ) : (
          <Button variant="outline" className="mt-2" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </motion.section>
  )
}
