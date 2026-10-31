import { defineConfig, devices } from '@playwright/test'

// Smoke tests against a running app with the demo data (`just seed`): they
// click through it like a person would. Run with `just e2e`.
export default defineConfig({
  testDir: './e2e',
  // One worker: every test logs in, and each login costs the API an Argon2 hash.
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
