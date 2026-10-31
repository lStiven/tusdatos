import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { LoaderCircle } from 'lucide-react'
import { z } from 'zod'
import { errorMessage } from '@/api/errors'
import { FormField, PasswordField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { es } from '@/i18n/es'
import { labEnabled } from '@/lib/env'
import { useLogin, type Credentials } from './api'
import { AuthLayout } from './auth-layout'
import { DemoAccounts } from './demo-accounts'
import { FormNotice } from '@/components/form-notice'
import { safeNext } from './safe-next'
import { takeEndReason, useToken } from './session'

const schema = z.object({
  email: z.email(es.auth.validation.email),
  password: z.string().min(1, es.auth.validation.passwordRequired),
})

const endNotices = {
  expired: es.auth.sessionExpired,
  logout: es.auth.loggedOut,
}

export function LoginPage() {
  const token = useToken()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNext(params.get('next'))
  const [endReason] = useState(takeEndReason)
  const login = useLogin()
  const { register, handleSubmit, setValue, formState } = useForm<Credentials>({
    resolver: zodResolver(schema),
  })

  if (token && !login.isPending) return <Navigate to={next} replace />

  const submit = handleSubmit((credentials) =>
    login.mutate(credentials, {
      onSuccess: () => navigate(next, { replace: true }),
    }),
  )

  return (
    <AuthLayout title={es.auth.loginTitle} subtitle={es.auth.loginSubtitle}>
      {endReason && !login.error && (
        <FormNotice tone="info" message={endNotices[endReason]} />
      )}
      <FormNotice message={login.error ? errorMessage(login.error) : null} />
      <form noValidate onSubmit={submit} className="space-y-4">
        <FormField
          label={es.auth.email}
          type="email"
          autoComplete="username"
          error={formState.errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label={es.auth.password}
          autoComplete="current-password"
          error={formState.errors.password?.message}
          {...register('password')}
        />
        <Button
          type="submit"
          size="lg"
          className="h-10 w-full shadow-md shadow-primary/20"
          disabled={login.isPending}
        >
          {login.isPending && (
            <LoaderCircle aria-hidden className="animate-spin" />
          )}
          {login.isPending ? es.auth.loggingIn : es.auth.login}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {es.auth.noAccount}{' '}
        <Link
          to="/registro"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {es.auth.goRegister}
        </Link>
      </p>
      {labEnabled && (
        <DemoAccounts
          disabled={login.isPending}
          onPick={(email, password) => {
            setValue('email', email)
            setValue('password', password)
            void submit()
          }}
        />
      )}
    </AuthLayout>
  )
}
