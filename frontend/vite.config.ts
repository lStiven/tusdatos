import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Same origin as the API in every environment: Vite proxies here, nginx in the image.
const apiUrl = process.env.API_URL ?? 'http://localhost:8000'
const apiProxy = { target: apiUrl, changeOrigin: true }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          // Large libraries that every screen uses and that change rarely: in
          // their own files they stay cached across deploys, and an update
          // only downloads the app's code again.
          groups: [
            {
              name: 'motion',
              test: /node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/,
            },
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': apiProxy, '/health': apiProxy },
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: { '/api': apiProxy, '/health': apiProxy },
  },
  test: {
    environment: 'jsdom',
    // e2e/ is Playwright's (`just e2e`), against a running app.
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    // Screens are driven like a person would (e.g. a date takes several clicks);
    // with coverage instrumentation a few tests go past the 5 s default.
    testTimeout: 15_000,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/api/schema.d.ts',
        'src/main.tsx',
        'src/test/**',
        // Vendored shadcn/ui primitives: library code, not ours.
        'src/components/ui/**',
        // Lab scenarios and races are acceptance checks run against the real
        // API from /laboratorio (verified there); their verdict logic, runner
        // and setup are unit-tested in checks, race-checks, runner and setup.
        'src/features/lab/scenarios.ts',
        'src/features/lab/races.ts',
      ],
      reporter: ['text-summary', 'html'],
      thresholds: { lines: 90, branches: 90 },
    },
  },
})
