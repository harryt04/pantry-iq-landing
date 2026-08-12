import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

try {
  process.loadEnvFile('.env.local')
} catch {
  // CI supplies its environment directly and does not have a local env file.
}

const port =
  process.env.PANTRYIQ_PORT ??
  (process.env.PANTRYIQ_E2E === '1' ? '3001' : '3000')
const baseURL = process.env.PANTRYIQ_BASE_URL ?? `http://localhost:${port}`
const authFile = path.resolve('tests/.auth/owner.json')

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
      name: 'setup',
      testDir: './tests/e2e/setup',
      testMatch: '**/*.setup.ts',
      fullyParallel: false,
      workers: 1,
      use: { ...devices['Desktop Chrome'], storageState: undefined },
    },
    {
      name: 'e2e',
      testDir: './tests/e2e',
      fullyParallel: false,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: authFile },
    },
    {
      name: 'ui',
      testDir: './tests/ui',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: authFile },
    },
    {
      name: 'design',
      testDir: './tests',
      testMatch: ['accessibility/landing.spec.ts', 'charts/**/*.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'real-data',
      testDir: './tests',
      testMatch: [
        'accessibility/real-data.spec.ts',
        'accessibility/mobile-dark.spec.ts',
      ],
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: authFile },
    },
  ],
})
