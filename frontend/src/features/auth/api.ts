import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'
import { startSession, useToken } from './session'

export interface Credentials {
  email: string
  password: string
}

export interface Registration extends Credentials {
  full_name: string
}

export const meQueryKey = ['users', 'me'] as const

/** The logged-in user with their roles, re-read from the API (roles can change). */
export function useCurrentUser() {
  const token = useToken()
  return useQuery({
    queryKey: meQueryKey,
    queryFn: () => unwrap(api.GET('/api/v1/users/me')),
    enabled: token !== null,
  })
}

export async function logIn({ email, password }: Credentials) {
  const token = await unwrap(
    api.POST('/api/v1/auth/token', {
      // OAuth2 password flow: form data, with the email as `username`.
      body: { username: email, password, scope: '' },
      bodySerializer: (body) =>
        new URLSearchParams(body as Record<string, string>),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }),
  )
  startSession(token.access_token, token.expires_in)
}

export function useLogin() {
  return useMutation({ mutationFn: logIn, meta: { silent: true } })
}

export function useRegister() {
  return useMutation({
    // Registering does not log in: the token comes from a second call.
    mutationFn: async (data: Registration) => {
      await unwrap(api.POST('/api/v1/auth/register', { body: data }))
      await logIn(data)
    },
    meta: { silent: true },
  })
}
