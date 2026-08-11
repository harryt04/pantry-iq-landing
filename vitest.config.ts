import path from 'node:path'

import { defineConfig } from 'vitest/config'

/**
 * Integration suites skip when no database is reachable, which drops coverage
 * by roughly ten points. Enforcing a threshold on that run would fail a laptop
 * without Docker for no good reason, so the gate only applies where the whole
 * suite can actually run. CI sets TEST_DATABASE_URL, so CI is always gated.
 */
const databaseAvailable =
  process.env.TEST_DATABASE_URL !== undefined ||
  process.env.TESTCONTAINERS_ENABLED === '1'

/**
 * Measured at 72.64% statements, 76.84% branches, 81.87% functions, and
 * 72.64% lines on 2026-08-11, held two points below so ordinary work does not
 * trip it. Raise these as coverage rises; never lower them to make a build
 * pass.
 */
const thresholds = {
  statements: 70.65,
  lines: 70.65,
  branches: 74.89,
  functions: 79.87,
}

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  // Next compiles JSX with the automatic runtime, so components do not import
  // React. Vitest defaults to the classic transform, which would fail on them.
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['**/*.test.ts', '**/*.test.tsx'],
    // TEST_DATABASE_URL points multiple integration files at one disposable
    // database, and migration tests intentionally reset it.
    fileParallelism:
      process.env.TEST_DATABASE_URL === undefined &&
      process.env.TESTCONTAINERS_ENABLED !== '1',
    // Only the interaction tests pay for a DOM. Everything else stays on node,
    // where the pure-logic suites run in milliseconds.
    environmentMatchGlobs: [['**/*.dom.test.tsx', 'jsdom']],
    setupFiles: ['tests/setup/dom.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      // Report on every source file, not only the ones a test already imports,
      // so an untested module shows as a zero rather than disappearing.
      all: true,
      include: [
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
        'lib/**/*.{ts,tsx}',
        'src/**/*.{ts,tsx}',
      ],
      exclude: [
        // Vendored shadcn/ui primitives are upstream code we do not test.
        'components/ui/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.ts',
        '**/*.config.{ts,mts,js}',
        'app/**/layout.tsx',
        'app/**/loading.tsx',
        'app/**/not-found.tsx',
        'src/server/db/schema.ts',
      ],
      ...(databaseAvailable ? { thresholds } : {}),
    },
  },
})
