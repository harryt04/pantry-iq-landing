import { defineConfig, devices } from '@playwright/test'

const port = process.env.PANTRYIQ_PORT ?? '3000'
const baseURL = process.env.PANTRYIQ_BASE_URL ?? `http://127.0.0.1:${port}`

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
  webServer: {
    command: `pnpm dev --hostname 127.0.0.1 --port ${port}`,
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
