import { Play, RotateCcw } from 'lucide-react'
import { FormNotice } from '@/components/form-notice'
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
import { useScenarioRun } from './runner'
import { scenarios, type LabEnv, type ScenarioId } from './scenarios'
import { StepStatusIcon } from './step-status'

const l = es.lab

export function ScenarioCard({
  id,
  env,
}: {
  id: ScenarioId
  env: () => LabEnv
}) {
  const texts = l.scenarios[id]
  // Each scenario has its own context type: the card only needs the runner.
  const { state, busy, run } = useScenarioRun(
    scenarios[id] as Parameters<typeof useScenarioRun>[0],
    env,
  )
  const passed = state.steps.filter((step) => step.status === 'pass').length

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>
          <h3>{texts.title}</h3>
        </CardTitle>
        <CardDescription>{texts.description}</CardDescription>
        <CardAction>
          <Button size="sm" onClick={run} disabled={busy}>
            {state.phase === 'idle' ? (
              <Play aria-hidden />
            ) : (
              <RotateCcw aria-hidden className={cn(busy && 'animate-spin')} />
            )}
            {busy ? l.running : state.phase === 'idle' ? l.run : l.runAgain}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <FormNotice
          message={state.phase === 'error' ? (state.error ?? null) : null}
        />
        <output
          aria-live="polite"
          className="block text-sm text-muted-foreground"
        >
          {state.phase === 'preparing' &&
            (state.accounts
              ? l.races.progress.accounts(
                  state.accounts.done,
                  state.accounts.total,
                )
              : l.preparing)}
          {state.phase === 'done' &&
            l.summary(
              passed,
              state.steps.length,
              ((state.durationMs ?? 0) / 1000).toFixed(1),
            )}
        </output>
        {/* Small screens: one card per step, no sideways scrolling. */}
        <ol className="space-y-2 md:hidden">
          {texts.steps.map((step, index) => {
            const result = state.steps[index] ?? { status: 'idle' as const }
            return (
              <li
                key={index}
                className={cn(
                  'space-y-1.5 rounded-xl border p-3 text-sm',
                  result.status === 'fail' && 'bg-danger-soft/60',
                  result.status === 'skipped' && 'text-muted-foreground',
                )}
              >
                <p className="flex items-center gap-2">
                  <StepStatusIcon status={result.status} />
                  <span className="font-medium">{step.who}</span>
                  <span>· {step.action}</span>
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
                  <dt className="font-sans text-muted-foreground">
                    {l.columns.expected}
                  </dt>
                  <dd>{step.expected}</dd>
                  <dt className="font-sans text-muted-foreground">
                    {l.columns.got}
                  </dt>
                  <dd
                    className={cn(
                      result.status === 'fail' && 'font-semibold text-danger',
                    )}
                  >
                    {result.got ?? '—'}
                  </dd>
                </dl>
              </li>
            )
          })}
        </ol>
        <div className="hidden overflow-x-auto rounded-xl border md:block">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="w-10 px-3 py-2">
                  <span className="sr-only">#</span>
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {l.columns.who}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {l.columns.action}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {l.columns.expected}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {l.columns.got}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {texts.steps.map((step, index) => {
                const result = state.steps[index] ?? { status: 'idle' as const }
                return (
                  <tr
                    key={index}
                    className={cn(
                      'align-top transition-colors',
                      result.status === 'fail' && 'bg-danger-soft/60',
                      result.status === 'skipped' && 'text-muted-foreground',
                    )}
                  >
                    <td className="px-3 py-2">
                      <StepStatusIcon status={result.status} />
                    </td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {step.who}
                    </td>
                    <td className="px-3 py-2">{step.action}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {step.expected}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 font-mono text-xs',
                        result.status === 'fail' && 'font-semibold text-danger',
                      )}
                    >
                      {result.got ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
