import path from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    include: ['**/*.test.ts', '**/*.test.tsx'],
    // TEST_DATABASE_URL points multiple integration files at one disposable
    // database, and migration tests intentionally reset it.
    fileParallelism: process.env.TEST_DATABASE_URL === undefined,
  },
})
