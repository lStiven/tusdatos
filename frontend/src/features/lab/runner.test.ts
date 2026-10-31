import { describe, expect, it, vi } from 'vitest'
import { es } from '@/i18n/es'
import { runScenario } from './runner'
import type { Scenario } from './scenarios'
import { LabSetupError } from './setup'

type Step = Scenario<string>['steps'][number]

const env = { adminToken: 'jwt', stamp: 'x' }
const pass = async () => ({ ok: true, got: '200' })
const fail = async () => ({ ok: false, got: '500' })

function scenario(overrides: Partial<Scenario<string>> = {}): Scenario<string> {
  return {
    prepare: async () => 'ctx',
    steps: [pass, pass],
    cleanup: vi.fn<Scenario<string>['cleanup']>(async () => {}),
    ...overrides,
  }
}

describe('runScenario', () => {
  it('runs every step in order and cleans up', async () => {
    const steps = [vi.fn<Step>(pass), vi.fn<Step>(pass)]
    const definition = scenario({ steps })
    const states: string[] = []

    const result = await runScenario(definition, env, (state) =>
      states.push(state.phase),
    )

    expect(result.phase).toBe('done')
    expect(result.steps.map((step) => step.status)).toEqual(['pass', 'pass'])
    expect(steps[0]).toHaveBeenCalledWith('ctx')
    expect(definition.cleanup).toHaveBeenCalledWith('ctx')
    expect(states[0]).toBe('preparing')
  })

  it('stops at the first failure, skips the rest and still cleans up', async () => {
    const last = vi.fn<Step>(pass)
    const definition = scenario({
      steps: [pass, fail, last],
    })

    const result = await runScenario(definition, env, () => {})

    expect(result.steps).toEqual([
      { status: 'pass', got: '200' },
      { status: 'fail', got: '500' },
      { status: 'skipped' },
    ])
    expect(last).not.toHaveBeenCalled()
    expect(definition.cleanup).toHaveBeenCalled()
  })

  it('turns a step that throws into a failure', async () => {
    const result = await runScenario(
      scenario({
        steps: [
          async () => {
            throw new Error('boom')
          },
        ],
      }),
      env,
      () => {},
    )

    expect(result.steps[0]).toEqual({ status: 'fail', got: es.lab.unexpected })
  })

  it.each([
    ['explains a failed preparation', new LabSetupError('No room'), 'No room'],
    ['hides unexpected errors', new Error('boom'), es.lab.unexpected],
  ])('%s', async (_, error, message) => {
    const definition = scenario({
      prepare: async () => {
        throw error
      },
    })

    const result = await runScenario(definition, env, () => {})

    expect(result).toMatchObject({ phase: 'error', error: message })
    expect(definition.cleanup).not.toHaveBeenCalled()
  })

  it('reports accounts while preparing', async () => {
    const states: (number | undefined)[] = []
    await runScenario(
      scenario({
        prepare: async (labEnv) => {
          labEnv.onAccount?.(1, 3)
          return 'ctx'
        },
      }),
      env,
      (state) => states.push(state.accounts?.done),
    )

    expect(states).toContain(1)
  })
})
