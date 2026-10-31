import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Providers } from '@/app'
import { startSession } from '@/features/auth/session'
import type { User } from '@/lib/permissions'
import { routes } from '@/routes'
import { handlers } from './fixtures'
import { server } from './server'

/** Mounts the real app at `path`; with `as`, logged in as that user. */
export function renderApp(path: string, { as }: { as?: User } = {}) {
  server.use(handlers.health())
  if (as) {
    startSession('jwt', 1800)
    server.use(handlers.me(as))
  }
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const user = userEvent.setup()
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  )
  return { router, user }
}
