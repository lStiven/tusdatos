import type { RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { RequireAuth, RequireRole } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/login-page'
import { RegisterPage } from '@/features/auth/register-page'
import { EventDetailPage } from '@/features/events/event-detail-page'
import { EventsPage } from '@/features/events/events-page'
import { HomePage } from '@/features/home/home-page'
import { MyRegistrationsPage } from '@/features/registrations/my-registrations-page'
import { ComingSoonPage } from '@/pages/coming-soon-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { es } from '@/i18n/es'
import { labEnabled } from '@/lib/env'

const organizer = ['ORGANIZER', 'ADMIN'] as const
const admin = ['ADMIN'] as const

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/registro', element: <RegisterPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'eventos', element: <EventsPage /> },
      { path: 'eventos/:eventId', element: <EventDetailPage /> },
      { path: 'mis-inscripciones', element: <MyRegistrationsPage /> },
      {
        path: 'organizador/eventos',
        element: (
          <RequireRole roles={[...organizer]}>
            <ComingSoonPage title={es.nav.myEvents} phase={3} />
          </RequireRole>
        ),
      },
      {
        path: 'ponentes',
        element: (
          <RequireRole roles={[...organizer]}>
            <ComingSoonPage title={es.nav.speakers} phase={3} />
          </RequireRole>
        ),
      },
      {
        path: 'admin/sedes',
        element: (
          <RequireRole roles={[...admin]}>
            <ComingSoonPage title={es.nav.venues} phase={4} />
          </RequireRole>
        ),
      },
      {
        path: 'admin/usuarios',
        element: (
          <RequireRole roles={[...admin]}>
            <ComingSoonPage title={es.nav.users} phase={4} />
          </RequireRole>
        ),
      },
      ...(labEnabled
        ? [
            {
              path: 'laboratorio',
              element: <ComingSoonPage title={es.nav.lab} phase={5} />,
            },
          ]
        : []),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
