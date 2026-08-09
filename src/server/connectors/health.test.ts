import { describe, expect, it } from 'vitest'

import {
  CONNECTOR_STALE_AFTER_MS,
  classifyConnectorHealth,
  elapsedLabel,
} from './health'

const now = new Date('2026-08-09T12:00:00.000Z')
const base = {
  connectionId: 'connection-1',
  locationId: 'location-1',
  provider: 'square',
  status: 'connected',
  lastError: null,
}

describe('connector health', () => {
  it('keeps a recently completed sync healthy', () => {
    expect(
      classifyConnectorHealth(
        {
          ...base,
          lastSyncedAt: new Date(now.getTime() - 2 * 60 * 60 * 1_000),
        },
        now,
      ),
    ).toMatchObject({ health: 'healthy', staleForMs: 2 * 60 * 60 * 1_000 })
  })

  it('marks a never-synced or old connection stale', () => {
    expect(
      classifyConnectorHealth({ ...base, lastSyncedAt: null }, now),
    ).toMatchObject({
      health: 'stale',
      staleForMs: null,
    })
    expect(
      classifyConnectorHealth(
        {
          ...base,
          lastSyncedAt: new Date(now.getTime() - CONNECTOR_STALE_AFTER_MS),
        },
        now,
      ).health,
    ).toBe('stale')
  })

  it('separates a failed sync from revoked or disconnected authorization', () => {
    expect(
      classifyConnectorHealth(
        { ...base, status: 'failed', lastSyncedAt: now },
        now,
      ).health,
    ).toBe('failed')
    expect(
      classifyConnectorHealth(
        { ...base, status: 'revoked', lastSyncedAt: now },
        now,
      ).health,
    ).toBe('revoked')
    expect(
      classifyConnectorHealth(
        { ...base, status: 'disconnected', lastSyncedAt: now },
        now,
      ).health,
    ).toBe('revoked')
  })

  it('uses readable elapsed labels without hiding missing history', () => {
    expect(elapsedLabel(null)).toBe('No successful sync yet')
    expect(elapsedLabel(25 * 60 * 60 * 1_000)).toBe('25 hours ago')
    expect(elapsedLabel(3 * 24 * 60 * 60 * 1_000)).toBe('3 days ago')
  })
})
