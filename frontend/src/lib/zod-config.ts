import { z } from 'zod'

// Zod 4 probes `new Function` to compile faster validators. The image's CSP
// (nginx.conf: scripts from 'self' only) blocks it, and the browser reports
// the blocked probe even though Zod falls back. Imported first in main.tsx:
// it must run before any schema is created.
z.config({ jitless: true })
