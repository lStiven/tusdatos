// First: configures Zod before any module creates a schema.
import './lib/zod-config'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { Providers } from './app'
import { initTheme } from './lib/theme'
import { routes } from './routes'
import './index.css'

initTheme()
const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
)
