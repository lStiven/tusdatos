import { useState } from 'react'
import { es } from '@/i18n/es'
import type { Check } from './checks'
import type { LabEnv, Scenario } from './scenarios'
import { LabSetupError } from './setup'

export type StepStatus = 'idle' | 'running' | 'pass' | 'fail' | 'skipped'

export interface StepState {
  status: StepStatus
  got?: string
}

export interface RunState {
  phase: 'idle' | 'preparing' | 'running' | 'done' | 'error'
  steps: StepState[]
  /** Why the preparation failed (`phase: 'error'`). */
  error?: string
  durationMs?: number
  /** Accounts created so far while preparing. */
  accounts?: { done: number; total: number }
}

export const idleRun = (steps: number): RunState => ({
  phase: 'idle',
  steps: Array.from({ length: steps }, () => ({ status: 'idle' })),
})

/**
 * Prepares the data, runs the steps in order and always cleans up. It stops at
 * the first failed step: the next ones depend on the state it should have left.
 */
export async function runScenario<C>(
  scenario: Scenario<C>,
  env: LabEnv,
  onChange: (state: RunState) => void,
): Promise<RunState> {
  const started = performance.now()
  let state = idleRun(scenario.steps.length)
  const update = (next: Partial<RunState>) => {
    state = { ...state, ...next }
    onChange(state)
  }
  const setStep = (index: number, step: StepState) =>
    update({ steps: state.steps.map((item, i) => (i === index ? step : item)) })

  update({ phase: 'preparing' })
  let ctx: C
  try {
    ctx = await scenario.prepare({
      ...env,
      onAccount: (done, total) => update({ accounts: { done, total } }),
    })
  } catch (error) {
    update({
      phase: 'error',
      error: error instanceof LabSetupError ? error.message : es.lab.unexpected,
    })
    return state
  }

  update({ phase: 'running' })
  try {
    for (const [index, step] of scenario.steps.entries()) {
      setStep(index, { status: 'running' })
      let check: Check
      try {
        check = await step(ctx)
      } catch {
        check = { ok: false, got: es.lab.unexpected }
      }
      setStep(index, { status: check.ok ? 'pass' : 'fail', got: check.got })
      if (!check.ok) {
        update({
          steps: state.steps.map((item, i) =>
            i > index ? { status: 'skipped' } : item,
          ),
        })
        break
      }
    }
  } finally {
    await scenario.cleanup(ctx).catch(() => undefined)
  }
  update({ phase: 'done', durationMs: performance.now() - started })
  return state
}

/** A scenario's live state for the UI; `env` is built per run (fresh accounts). */
export function useScenarioRun<C>(scenario: Scenario<C>, env: () => LabEnv) {
  const [state, setState] = useState(() => idleRun(scenario.steps.length))
  const busy = state.phase === 'preparing' || state.phase === 'running'
  return {
    state,
    busy,
    run: () => {
      if (!busy) void runScenario(scenario, env(), setState)
    },
  }
}
