import { ExternalLink, Radio, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { es } from '@/i18n/es'
import { apiDocsUrl } from '@/lib/env'
import { cn } from '@/lib/utils'
import {
  clearRequests,
  useInspectedRequests,
  type InspectedRequest,
} from './store'

function statusTone(status: number | null) {
  if (status === null) return 'bg-muted text-muted-foreground'
  if (status >= 200 && status < 300) return 'bg-success-soft text-success'
  if (status >= 400 && status < 500) return 'bg-warning-soft text-warning'
  return 'bg-destructive/10 text-destructive'
}

function statusLabel({ status }: InspectedRequest) {
  if (status === null) return es.inspector.pending
  if (status === 0) return es.inspector.networkError
  return String(status)
}

function Entry({ entry }: { entry: InspectedRequest }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-lg border bg-card shadow-xs transition-shadow hover:shadow-md"
    >
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="w-12 shrink-0 font-mono font-semibold">
            {entry.method}
          </span>
          <span
            className="min-w-0 flex-1 truncate font-mono"
            title={entry.path}
          >
            {entry.path}
          </span>
          {entry.code && (
            <span className="hidden truncate font-mono text-muted-foreground sm:inline">
              {entry.code}
            </span>
          )}
          <Badge
            className={cn(
              'border-transparent font-mono',
              statusTone(entry.status),
            )}
          >
            {statusLabel(entry)}
          </Badge>
          <span className="w-14 shrink-0 text-right text-muted-foreground tabular-nums">
            {entry.durationMs === null ? '…' : `${entry.durationMs} ms`}
          </span>
        </summary>
        <div className="grid gap-2 border-t px-3 py-2">
          {[
            [es.inspector.request, entry.requestBody],
            [es.inspector.response, entry.responseBody],
          ].map(
            ([label, body]) =>
              body && (
                <div key={label}>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    {label}
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-[11px] leading-relaxed">
                    {body}
                  </pre>
                </div>
              ),
          )}
        </div>
      </details>
    </motion.li>
  )
}

export function InspectorPanel() {
  const entries = useInspectedRequests()
  const failures = entries.filter(
    (entry) => entry.status !== null && entry.status >= 400,
  ).length

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={es.inspector.open}
        >
          <Radio aria-hidden />
          <AnimatePresence>
            {entries.length > 0 && (
              <motion.span
                key={failures > 0 ? 'failures' : 'ok'}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                aria-hidden
                className={cn(
                  'absolute top-1 right-1 size-2 rounded-full',
                  failures > 0 ? 'bg-destructive' : 'bg-success',
                )}
              />
            )}
          </AnimatePresence>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{es.inspector.title}</SheetTitle>
          <SheetDescription>{es.inspector.description}</SheetDescription>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearRequests}
              disabled={entries.length === 0}
            >
              <Trash2 aria-hidden />
              {es.inspector.clear}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={apiDocsUrl} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden />
                {es.inspector.apiDocs}
              </a>
            </Button>
          </div>
        </SheetHeader>
        {entries.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {es.inspector.empty}
          </p>
        ) : (
          <ul className="flex flex-col gap-2 overflow-y-auto p-4">
            {entries.map((entry) => (
              <Entry key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  )
}
