import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ConnectionHealthNotice } from './connection-health-notice'

const now = new Date()

describe('connection health notice', () => {
  it('stays quiet when every connection recently synced', () => {
    const markup = renderToStaticMarkup(
      <ConnectionHealthNotice
        locationId="location-1"
        connections={[
          {
            connectionId: 'connection-1',
            locationId: 'location-1',
            provider: 'square',
            status: 'connected',
            lastSyncedAt: new Date(now.getTime() - 60 * 60 * 1_000),
            lastError: null,
          },
        ]}
      />,
    )

    expect(markup).toBe('')
  })

  it('explains stale, failed, and revoked connections with a recovery path', () => {
    const markup = renderToStaticMarkup(
      <ConnectionHealthNotice
        locationId="location-1"
        connections={[
          {
            connectionId: 'connection-stale',
            locationId: 'location-1',
            provider: 'square',
            status: 'connected',
            lastSyncedAt: new Date(now.getTime() - 48 * 60 * 60 * 1_000),
            lastError: null,
          },
          {
            connectionId: 'connection-failed',
            locationId: 'location-1',
            provider: 'toast',
            status: 'failed',
            lastSyncedAt: now,
            lastError: 'sync-failed',
          },
          {
            connectionId: 'connection-revoked',
            locationId: 'location-1',
            provider: 'quickbooks',
            status: 'revoked',
            lastSyncedAt: now,
            lastError: 'authorization-revoked',
          },
        ]}
      />,
    )

    expect(markup).toContain('Some imported numbers may be out of date.')
    expect(markup).toContain('Square: Data is stale')
    expect(markup).toContain('Toast: Sync failed')
    expect(markup).toContain('QuickBooks: Reconnect required')
    expect(markup).toContain(
      'The dashboard is still using the last successful data',
    )
    expect(markup).toContain('/import?locationId=location-1')
    expect(markup).toContain('aria-hidden="true"')
  })
})
