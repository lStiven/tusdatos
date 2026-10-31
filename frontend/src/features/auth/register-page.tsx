import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate, useNavigate } from 'react-router'
import { LoaderCircle } from 'lucide-react'
import { z } from 'zod'
import { FormField, PasswordField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { es } from '@/i18n/es'
import {
  formLevelError,
  showFieldErrors,
  type CodeFields,
} from '@/lib/form-errors'
import { useRegister, type Registration } from './api'
import { AuthLayout } from './auth-layout'
import { FormNotice } from '@/components/form-notice'
import { useToken } from './session'

const schema = z.object({
  full_name: z.string().trim().min(1, es.auth.validation.fullName).max(200),
  email: z.email(es.auth.validation.email),
  password: z
    .string()
    .min(8, es.auth.validation.passwordLength)
    .max(128, es.auth.validation.passwordLength),
})

// `email_taken` goes next to the email; other errors, above the form.
const byCode: CodeFields<Registration> = { email_taken: 'email' }

export function RegisterPage() {
  const token = useToken()
  const navigate = useNavigate()
  const signUp = useRegister()
  const { register, handleSubmit, setError, formState } = useForm<Registration>(
    {
      resolver: zodResolver(schema),
    },
  )

  if (token && !signUp.isPending) return <Navigate to="/" replace />

  const submit = handleSubmit((data) =>
    signUp.mutate(data, {
      onSuccess: () => navigate('/', { replace: true }),
      onError: (error) =>
        showFieldErrors(error, setError, Object.keys(schema.shape), byCode),
    }),
  )
  const formLevel = formLevelError(signUp.error, byCode)

  return (
    <AuthLayout
      title={es.auth.registerTitle}
      subtitle={es.auth.registerSubtitle}
    >
      <FormNotice message={formLevel} />
      <form noValidate onSubmit={submit} className="space-y-4">
        <FormField
          label={es.auth.fullName}
          autoComplete="name"
          error={formState.errors.full_name?.message}
          {...register('full_name')}
        />
        <FormField
          label={es.auth.email}
          type="email"
          autoComplete="email"
          error={formState.errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label={es.auth.password}
          autoComplete="new-password"
          hint={es.auth.passwordHint}
          error={formState.errors.password?.message}
          {...register('password')}
        />
        <Button
          type="submit"
          size="lg"
          className="h-10 w-full shadow-md shadow-primary/20"
          disabled={signUp.isPending}
        >
          {signUp.isPending && (
            <LoaderCircle aria-hidden className="animate-spin" />
          )}
          {signUp.isPending ? es.auth.registering : es.auth.register}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {es.auth.haveAccount}{' '}
        <Link
          to="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {es.auth.goLogin}
        </Link>
      </p>
    </AuthLayout>
  )
}
