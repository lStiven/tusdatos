import type { components } from '@/api/schema'
import { describeReply, type Reply } from './client'

type Registration = components['schemas']['RegistrationRead']

/** A step's verdict: whether the API did what the business rules promise. */
export interface Check {
  ok: boolean
  got: string
}

export function expectReply(
  reply: Reply<unknown>,
  status: number,
  code: string | null = null,
): Check {
  return {
    ok: reply.status === status && reply.code === code,
    got: describeReply(reply),
  }
}

/** Status code plus the registration state the server decided. */
export function expectRegistration(
  reply: Reply<Registration>,
  status: number,
  state: Registration['status'],
  position: number | null = null,
): Check {
  const data = reply.data
  const got = data
    ? `${reply.status} ${data.status}${data.waitlist_position ? ` #${data.waitlist_position}` : ''}`
    : describeReply(reply)
  return {
    ok:
      reply.status === status &&
      data?.status === state &&
      data.waitlist_position === position,
    got,
  }
}

/** Several checks read as one step: all must hold. */
export function all(...checks: Check[]): Check {
  return {
    ok: checks.every((check) => check.ok),
    got: checks.map((check) => check.got).join(' · '),
  }
}
