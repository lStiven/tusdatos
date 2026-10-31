import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { endSession, takeEndReason } from '@/features/auth/session'
import { clearRequests } from '@/features/inspector/store'
import { server } from './server'

// jsdom lacks these browser APIs; next-themes, Motion and Radix use them.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.scrollTo = () => {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

// Coverage instrumentation slows rendering: 1 s (the default) is too tight.
configure({ asyncUtilTimeout: 3000 })

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
// Lazy screens (routes.tsx) load in the browser in milliseconds, but their first
// import inside Vitest transforms a whole chunk: done here once per file, so
// tests measure the screens and not the bundler.
beforeAll(() =>
  Promise.all([
    import('@/features/organizer/pages'),
    import('@/features/admin/pages'),
    import('@/features/lab/lab-page'),
  ]),
)
afterEach(() => {
  cleanup()
  server.resetHandlers()
  endSession('logout')
  takeEndReason()
  clearRequests()
  sessionStorage.clear()
})
afterAll(() => server.close())
