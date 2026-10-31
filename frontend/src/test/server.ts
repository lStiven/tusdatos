import { setupServer } from 'msw/node'

/** API double for every test; each test adds its handlers with `server.use(...)`. */
export const server = setupServer()
