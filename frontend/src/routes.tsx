import { Outlet, type RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { UsersPage } from '@/features/admin/users-page'
import { VenueDetailPage } from '@/features/admin/venue-detail-page'
import { VenuesPage } from '@/features/admin/venues-page'
import { RequireAuth, RequireRole } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/login-page'
import { RegisterPage } from '@/features/auth/register-page'
import { EventDetailPage } from '@/features/events/event-detail-page'
import { EventsPage } from '@/features/events/events-page'
import { HomePage } from '@/features/home/home-page'
import {
  EditEventPage,
  NewEventPage,
} from '@/features/organizer/event-form-page'
import { ManageEventPage } from '@/features/organizer/manage-event-page'
import { MyEventsPage } from '@/features/organizer/my-events-page'
import { MyRegistrationsPage } from '@/features/registrations/my-registrations-page'
import { SpeakersPage } from '@/features/speakers/speakers-page'
import { ComingSoonPage } from '@/pages/coming-soon-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { RouteErrorPage } from '@/pages/route-error-page'
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
      {
        // Pathless: a crash shows inside the shell, which keeps working.
        errorElement: <RouteErrorPage />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'eventos', element: <EventsPage /> },
          { path: 'eventos/:eventId', element: <EventDetailPage /> },
          { path: 'mis-inscripciones', element: <MyRegistrationsPage /> },
          {
            path: 'organizador/eventos',
            element: (
              <RequireRole roles={[...organizer]}>
                <Outlet />
              </RequireRole>
            ),
            children: [
              { index: true, element: <MyEventsPage /> },
              { path: 'nuevo', element: <NewEventPage /> },
              { path: ':eventId', element: <ManageEventPage /> },
              { path: ':eventId/editar', element: <EditEventPage /> },
            ],
          },
          {
            path: 'ponentes',
            element: (
              <RequireRole roles={[...organizer]}>
                <SpeakersPage />
              </RequireRole>
            ),
          },
          {
            path: 'admin',
            element: (
              <RequireRole roles={[...admin]}>
                <Outlet />
              </RequireRole>
            ),
            children: [
              { path: 'sedes', element: <VenuesPage /> },
              { path: 'sedes/:venueId', element: <VenueDetailPage /> },
              { path: 'usuarios', element: <UsersPage /> },
            ],
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
    ],
  },
]
