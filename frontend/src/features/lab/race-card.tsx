import { CircleCheck, CircleX, Zap } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { FormField } from '@/components/form-field'
import { FormNotice } from '@/components/form-notice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { es } from '@/i18n/es'
import { cn } from '@/lib/utils'
import {
  clamp,
  MAX_REQUESTS,
  MIN_REQUESTS,
  tally,
  type Outcome,
} from './race-checks'
import { races, type RaceId, type RaceProgress, type RaceResult } from './races'
import type { LabEnv } from './scenarios'
import { LabSetupError } from './setup'

const t = es.lab.races
type RaceState =
  | { phase: 'idle' }
  | { phase: 'running'; progress: RaceProgress }
  | { phase: 'done'; result: RaceResult }
  | { phase: 'error'; message: string }

function progressText(progress: RaceProgress) {
  return progress.phase === 'accounts'
    ? t.progress.accounts(progress.done, progress.total)
    : t.progress[progress.phase]
}

function tone(outcome: Outcome) {
  if (outcome.status === 200 || outcome.status === 201) return 'bg-success'
  if (outcome.status === 409 || outcome.status === 204) return 'bg-info'
  if (outcome.status === 503) return 'bg-warning'
  return 'bg-danger'
}

export function RaceCard({ id, env }: { id: RaceId; env: () => LabEnv }) {
  const texts = t.list[id]
  const [n, setN] = useState('20')
  const [capacity, setCapacity] = useState('5')
  const [state, setState] = useState<RaceState>({ phase: 'idle' })
  const running = state.phase === 'running'

  async function run() {
    const requests = clamp(n, MIN_REQUESTS, MAX_REQUESTS)
    const seats = clamp(capacity, 1, requests)
    setN(String(requests))
    setCapacity(String(seats))
    setState({ phase: 'running', progress: { phase: 'preparing' } })
    try {
      const result = await races[id](
        env(),
        { n: requests, capacity: seats },
        (progress) => setState({ phase: 'running', progress }),
      )
      setState({ phase: 'done', result })
    } catch (error) {
      setState({
        phase: 'error',
        message: t.failed(
          error instanceof LabSetupError ? error.message : es.lab.unexpected,
        ),
      })
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>
          <h3>{texts.title}</h3>
        </CardTitle>
        <CardDescription>{texts.description}</CardDescription>
        {/* Same place as in the scenarios: the action, top right. */}
        <CardAction>
          <Button size="sm" onClick={() => void run()} disabled={running}>
            <Zap aria-hidden className={cn(running && 'animate-pulse')} />
            {running ? es.lab.running : es.lab.run}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Every field with label, input and hint: the inputs line up. */}
        <div className="grid gap-4 sm:grid-cols-[repeat(2,minmax(0,14rem))]">
          <FormField
            label={t.users}
            type="number"
            inputMode="numeric"
            min={MIN_REQUESTS}
            max={MAX_REQUESTS}
            hint={t.usersHint(MIN_REQUESTS, MAX_REQUESTS)}
            value={n}
            onChange={(event) => setN(event.target.value)}
            disabled={running}
          />
          {id === 'lastSeat' && (
            <FormField
              label={t.capacity}
              type="number"
              inputMode="numeric"
              min={1}
              hint={t.capacityHint}
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              disabled={running}
            />
          )}
        </div>

        <output
          aria-live="polite"
          className="block text-sm text-muted-foreground"
        >
          {state.phase === 'running' && progressText(state.progress)}
        </output>
        <FormNotice message={state.phase === 'error' ? state.message : null} />
        {state.phase === 'done' && <RaceResultView result={state.result} />}
      </CardContent>
    </Card>
  )
}

function RaceResultView({ result }: { result: RaceResult }) {
  const passed = result.checks.every((check) => check.ok)
  const slowest = Math.max(...result.outcomes.map((outcome) => outcome.ms))
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 rounded-xl border bg-muted/30 p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          className={cn(
            'border-transparent',
            passed
              ? 'bg-success-soft text-success'
              : 'bg-danger-soft text-danger',
          )}
        >
          {passed ? <CircleCheck aria-hidden /> : <CircleX aria-hidden />}
          {passed ? t.verdict.pass : t.verdict.fail}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {t.duration(Math.round(result.durationMs))} ·{' '}
          {t.slowest(Math.round(slowest))}
        </span>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">{t.responses}</h4>
        {/* One square per request, in send order: the text below says the same. */}
        <div aria-hidden className="flex flex-wrap gap-1">
          {result.outcomes.map((outcome, index) => (
            <motion.span
              key={index}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.015 }}
              className={cn('size-3.5 rounded-sm', tone(outcome))}
              title={`${outcome.status} ${outcome.code ?? ''} · ${Math.round(outcome.ms)} ms`}
            />
          ))}
        </div>
        <ul className="flex flex-wrap gap-2">
          {tally(result.outcomes).map(([label, times]) => (
            <li key={label}>
              <Badge variant="outline" className="font-mono">
                {label} × {times}
              </Badge>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">{t.checksTitle}</h4>
        <ul className="space-y-1.5">
          {result.checks.map((check) => (
            <li key={check.label} className="flex items-start gap-2 text-sm">
              {check.ok ? (
                <CircleCheck
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-success"
                />
              ) : (
                <CircleX
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-danger"
                />
              )}
              <span>
                <span className="sr-only">
                  {check.ok ? es.lab.stepStatus.pass : es.lab.stepStatus.fail}
                  :{' '}
                </span>
                {check.label}{' '}
                <span className="font-mono text-xs text-muted-foreground">
                  ({check.detail})
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}
