import type { ComponentType } from 'react'
import { Outlet, type RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { RequireAuth, RequireRole } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/login-page'
import { RegisterPage } from '@/features/auth/register-page'
import { EventDetailPage } from '@/features/events/event-detail-page'
import { EventsPage } from '@/features/events/events-page'
import { HomePage } from '@/features/home/home-page'
import { MyRegistrationsPage } from '@/features/registrations/my-registrations-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { RouteErrorPage } from '@/pages/route-error-page'
import { RouteLoading } from '@/pages/route-loading'
import { labEnabled } from '@/lib/env'

const organizer = ['ORGANIZER', 'ADMIN'] as const
const admin = ['ADMIN'] as const

// What every user needs ships in the main bundle. Organizer, admin and lab
// screens (forms, calendar, the lab) load on first visit: an attendee never
// downloads them.
const lazily =
  <M,>(load: () => Promise<M>, pick: (module: M) => ComponentType) =>
  async () => ({ Component: pick(await load()) })

const organizerPages = () => import('@/features/organizer/pages')
const adminPages = () => import('@/features/admin/pages')

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/registro', element: <RegisterPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    // Shown on a first load straight into a lazy screen, while it downloads.
    hydrateFallbackElement: <RouteLoading />,
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
            element: (
              <RequireRole roles={[...organizer]}>
                <Outlet />
              </RequireRole>
            ),
            children: [
              {
                path: 'organizador/eventos',
                lazy: lazily(organizerPages, (m) => m.MyEventsPage),
              },
              {
                path: 'organizador/eventos/nuevo',
                lazy: lazily(organizerPages, (m) => m.NewEventPage),
              },
              {
                path: 'organizador/eventos/:eventId',
                lazy: lazily(organizerPages, (m) => m.ManageEventPage),
              },
              {
                path: 'organizador/eventos/:eventId/editar',
                lazy: lazily(organizerPages, (m) => m.EditEventPage),
              },
              {
                path: 'ponentes',
                lazy: lazily(organizerPages, (m) => m.SpeakersPage),
              },
            ],
          },
          {
            element: (
              <RequireRole roles={[...admin]}>
                <Outlet />
              </RequireRole>
            ),
            children: [
              {
                path: 'admin/sedes',
                lazy: lazily(adminPages, (m) => m.VenuesPage),
              },
              {
                path: 'admin/sedes/:venueId',
                lazy: lazily(adminPages, (m) => m.VenueDetailPage),
              },
              {
                path: 'admin/usuarios',
                lazy: lazily(adminPages, (m) => m.UsersPage),
              },
            ],
          },
          ...(labEnabled
            ? [
                {
                  path: 'laboratorio',
                  lazy: lazily(
                    () => import('@/features/lab/lab-page'),
                    (m) => m.LabPage,
                  ),
                },
              ]
            : []),
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]
