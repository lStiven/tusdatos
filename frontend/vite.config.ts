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
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
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
      ],
      reporter: ['text-summary', 'html'],
      thresholds: { lines: 90, branches: 90 },
    },
  },
})
