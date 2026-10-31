import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate, useNavigate } from 'react-router'
import { LoaderCircle } from 'lucide-react'
import { z } from 'zod'
import { ApiError, errorMessage, fieldErrors } from '@/api/errors'
import { FormField, PasswordField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { es } from '@/i18n/es'
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
      onError: (error) => {
        // Errors that belong to a field go next to it; the rest, above the form.
        if (error instanceof ApiError && error.code === 'email_taken') {
          setError('email', { message: errorMessage(error) })
        }
        for (const [field, message] of Object.entries(fieldErrors(error))) {
          if (field in schema.shape)
            setError(field as keyof Registration, { message })
        }
      },
    }),
  )
  const formLevel =
    signUp.error &&
    signUp.error.code !== 'email_taken' &&
    signUp.error.status !== 422
      ? errorMessage(signUp.error)
      : null

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
