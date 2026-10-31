import { afterEach, describe, expect, it, vi } from 'vitest'
import { endSession, getToken, startSession, takeEndReason } from './session'

describe('session', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('expires with the token lifetime and says why', () => {
    vi.useFakeTimers()
    startSession('jwt', 60)
    expect(getToken()).toBe('jwt')

    vi.advanceTimersByTime(60_000)
    expect(getToken()).toBeNull()
    expect(takeEndReason()).toBe('expired')
    expect(takeEndReason()).toBeNull()
  })

  it('survives a page reload in the same tab', async () => {
    startSession('jwt', 60)
    vi.resetModules()
    const reloaded = await import('./session')
    expect(reloaded.getToken()).toBe('jwt')

    endSession('logout')
    vi.resetModules()
    expect((await import('./session')).getToken()).toBeNull()
  })
})
