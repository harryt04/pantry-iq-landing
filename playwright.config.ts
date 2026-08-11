import { defineConfig, devices } from '@playwright/test'

try {
  process.loadEnvFile('.env.local')
} catch {
  // CI supplies its environment directly and does not have a local env file.
}

const port =
  process.env.PANTRYIQ_PORT ??
  (process.env.PANTRYIQ_E2E === '1' ? '3001' : '3000')
const baseURL = process.env.PANTRYIQ_BASE_URL ?? `http://localhost:${port}`

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  expect: {
    timeout: 15_000,
  },
  webServer: {
    command: `env -u FORCE_COLOR -u NO_COLOR BETTER_AUTH_URL=http://localhost:${port} pnpm dev --hostname 127.0.0.1 --port ${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: `${baseURL}/api/health`,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
