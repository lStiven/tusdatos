import { describe, expect, it } from 'vitest'
import { makeRegistration } from '@/test/fixtures'
import { all, expectRegistration, expectReply } from './checks'

const reply = <T>(status: number, code: string | null, data?: T) => ({
  status,
  code,
  data,
})

describe('lab checks', () => {
  it.each([
    [reply(409, 'registration_closed'), 409, 'registration_closed', true],
    [reply(409, 'event_not_open'), 409, 'registration_closed', false],
    [reply(204, null), 204, null, true],
    [reply(200, null), 204, null, false],
  ])('%o vs %s %s → %s', (got, status, code, ok) => {
    expect(expectReply(got, status, code).ok).toBe(ok)
  })

  it('checks the state and queue position the server decided', () => {
    const waitlisted = reply(
      201,
      null,
      makeRegistration({ status: 'WAITLISTED', waitlist_position: 2 }),
    )
    expect(expectRegistration(waitlisted, 201, 'WAITLISTED', 2)).toEqual({
      ok: true,
      got: '201 WAITLISTED #2',
    })
    expect(expectRegistration(waitlisted, 201, 'WAITLISTED', 1).ok).toBe(false)
    expect(expectRegistration(waitlisted, 200, 'WAITLISTED', 2).ok).toBe(false)
    // Without a body, the reply says what came instead.
    expect(
      expectRegistration(reply(409, 'registration_closed'), 201, 'CONFIRMED'),
    ).toEqual({ ok: false, got: '409 registration_closed' })
  })

  it('joins checks: all must hold', () => {
    const pass = { ok: true, got: '200' }
    const fail = { ok: false, got: '409' }
    expect(all(pass, pass)).toEqual({ ok: true, got: '200 · 200' })
    expect(all(pass, fail).ok).toBe(false)
  })
})
