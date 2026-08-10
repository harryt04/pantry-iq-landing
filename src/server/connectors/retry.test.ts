import { describe, expect, it } from 'vitest'

import {
  isRetryableConnectorError,
  retryDelayMs,
  withConnectorRetry,
} from './retry'
import { ConnectorAuthorizationRevokedError } from './types'

describe('connector retry policy', () => {
  it('uses bounded exponential backoff', () => {
    expect(retryDelayMs(1)).toBe(1_000)
    expect(retryDelayMs(2)).toBe(2_000)
    expect(retryDelayMs(7)).toBe(60_000)
  })

  it('does not retry revoked authorizations', () => {
    expect(
      isRetryableConnectorError(new ConnectorAuthorizationRevokedError()),
    ).toBe(false)
  })

  it('retries transient failures and eventually succeeds', async () => {
    let attempts = 0
    const sleeps: number[] = []
    await expect(
      withConnectorRetry(
        async () => {
          attempts += 1
          if (attempts < 3) throw new Error('temporary')
          return 'ok'
        },
        { maxAttempts: 3, initialDelayMs: 5, maxDelayMs: 20 },
        async (delay) => {
          sleeps.push(delay)
        },
      ),
    ).resolves.toBe('ok')
    expect(attempts).toBe(3)
    expect(sleeps).toEqual([5, 10])
  })
})
