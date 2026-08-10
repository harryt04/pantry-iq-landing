import { afterEach, describe, expect, it } from 'vitest'

import { integrationDatabaseEnabled } from './test-database'

const originalTestDatabaseUrl = process.env.TEST_DATABASE_URL
const originalTestcontainersEnabled = process.env.TESTCONTAINERS_ENABLED

afterEach(() => {
  if (originalTestDatabaseUrl === undefined) {
    delete process.env.TEST_DATABASE_URL
  } else {
    process.env.TEST_DATABASE_URL = originalTestDatabaseUrl
  }

  if (originalTestcontainersEnabled === undefined) {
    delete process.env.TESTCONTAINERS_ENABLED
  } else {
    process.env.TESTCONTAINERS_ENABLED = originalTestcontainersEnabled
  }
})

describe('integration database selection', () => {
  it('enables the harness for a localhost database URL', () => {
    process.env.TEST_DATABASE_URL =
      'postgresql://pantryiq:pantryiq@localhost:5433/pantryiq_test'
    delete process.env.TESTCONTAINERS_ENABLED

    expect(integrationDatabaseEnabled()).toBe(true)
  })

  it('enables the harness for Testcontainers in CI', () => {
    delete process.env.TEST_DATABASE_URL
    process.env.TESTCONTAINERS_ENABLED = '1'

    expect(integrationDatabaseEnabled()).toBe(true)
  })

  it('rejects an external database because the round trip is destructive', () => {
    process.env.TEST_DATABASE_URL =
      'postgresql://pantryiq:pantryiq@db.example.com/pantryiq_test'

    expect(() => integrationDatabaseEnabled()).toThrow(
      'TEST_DATABASE_URL must point to localhost',
    )
  })

  it('rejects malformed database URLs', () => {
    process.env.TEST_DATABASE_URL = 'not-a-database-url'

    expect(() => integrationDatabaseEnabled()).toThrow(
      'TEST_DATABASE_URL must be a valid PostgreSQL URL',
    )
  })
})
