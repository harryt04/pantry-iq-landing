import { createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  createToastConnector,
  toastWebhookSignature,
  ToastItemResolutionError,
} from './toast'
import { ConnectorAuthorizationRevokedError } from './types'

const webhookUrl = 'https://pantryiq.test/api/connectors/toast/webhook'
const item = {
  id: '11111111-1111-4111-8111-111111111111',
  canonicalName: 'Salmon',
  displayName: 'Salmon',
  category: 'protein',
  unit: 'lb',
}

function response(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function connector(fetchImpl: typeof fetch) {
  return createToastConnector({
    clientId: 'toast-client',
    clientSecret: 'toast-secret',
    restaurantExternalId: 'RESTAURANT-1',
    webhookSecret: 'webhook-secret',
    webhookUrl,
    items: [item],
    apiBaseUrl: 'https://toast.test',
    fetchImpl,
  })
}

describe('Toast connector', () => {
  it('uses Toast machine-client authentication without exposing credentials in its handoff URL', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const toast = connector(async (input, init) => {
      calls.push({
        url: String(input),
        ...(init ? { init } : {}),
      })
      return response({
        status: 'SUCCESS',
        token: {
          accessToken: 'access-token',
          expiresIn: 86400,
          scope: 'orders:read menus:read',
        },
      })
    })

    const handoff = new URL(
      toast.authorizationUrl({
        state: 'state-value',
        redirectUri: webhookUrl,
      }),
    )
    expect(handoff.searchParams.get('state')).toBe('state-value')
    expect(handoff.searchParams.get('restaurant')).toBe('RESTAURANT-1')
    expect(handoff.toString()).not.toContain('toast-secret')

    await expect(
      toast.exchangeCode({
        code: 'opaque-setup-handoff',
        redirectUri: webhookUrl,
      }),
    ).resolves.toMatchObject({
      providerAccountId: 'RESTAURANT-1',
      tokens: { accessToken: 'access-token', scope: 'orders:read menus:read' },
    })
    expect(calls[0]?.url).toBe(
      'https://toast.test/authentication/v1/authentication/login',
    )
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      clientId: 'toast-client',
      clientSecret: 'toast-secret',
      userAccessType: 'TOAST_MACHINE_CLIENT',
    })
  })

  it('normalizes menu-backed order selections with exact item resolution and decimal totals', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const toast = connector(async (input, init) => {
      const url = String(input)
      requests.push({ url, ...(init ? { init } : {}) })
      if (url.includes('/config/v2/menuItems'))
        return response([{ guid: 'TOAST_ITEM', name: 'Salmon' }])
      return response([
        {
          guid: 'ORDER-1',
          openedDate: '2026-08-09T01:15:00.000Z',
          checks: [
            {
              closedDate: '2026-08-09T01:30:00.000Z',
              selections: [
                {
                  guid: 'SELECTION-1',
                  displayName: 'Toast display label',
                  item: { guid: 'TOAST_ITEM' },
                  quantity: 2,
                  price: 12.5,
                },
              ],
            },
          ],
        },
      ])
    })

    await expect(
      toast.backfill({
        tokens: { accessToken: 'access-token' },
        cursor: null,
      }),
    ).resolves.toMatchObject({
      records: [
        {
          kind: 'transaction',
          source: 'toast',
          externalId: 'ORDER-1:SELECTION-1',
          transactedAt: new Date('2026-08-09T01:30:00.000Z'),
          itemId: item.id,
          rawItemName: 'Salmon',
          category: 'protein',
          qty: '2',
          unitPrice: '12.5',
          totalRevenue: '25',
          totalCost: null,
          grossMargin: null,
        },
      ],
    })
    expect(requests[1]?.init?.headers).toMatchObject({
      Authorization: 'Bearer access-token',
      'Toast-Restaurant-External-ID': 'RESTAURANT-1',
    })
  })

  it('rejects an unmatched Toast menu item instead of guessing', async () => {
    const toast = connector(async (input) => {
      if (String(input).includes('/config/v2/menuItems'))
        return response([{ guid: 'TOAST_ITEM', name: 'Unknown Fish' }])
      return response([
        {
          guid: 'ORDER-1',
          openedDate: '2026-08-09T01:15:00.000Z',
          checks: [
            {
              selections: [
                {
                  item: { guid: 'TOAST_ITEM' },
                  quantity: 1,
                  price: 10,
                },
              ],
            },
          ],
        },
      ])
    })

    await expect(
      toast.backfill({ tokens: { accessToken: 'access-token' }, cursor: null }),
    ).rejects.toBeInstanceOf(ToastItemResolutionError)
  })

  it('returns a resumable cursor when Toast fills a page', async () => {
    let orderRequest = 0
    const toast = connector(async (input) => {
      const url = String(input)
      if (url.includes('/config/v2/menuItems')) return response([])
      orderRequest += 1
      return response(
        orderRequest === 1
          ? Array.from({ length: 100 }, () => ({
              guid: `ORDER-${orderRequest}`,
              checks: [],
            }))
          : [],
      )
    })

    const first = await toast.incremental({
      tokens: { accessToken: 'access-token' },
      cursor: null,
    })
    expect(first.complete).toBe(false)
    expect(first.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/u)

    const second = await toast.incremental({
      tokens: { accessToken: 'access-token' },
      cursor: first.nextCursor,
    })
    expect(second.complete).toBe(true)
    expect(orderRequest).toBe(2)
  })

  it('verifies Toast webhook signatures over the raw body plus timestamp', async () => {
    const toast = connector(async () => response([]))
    const rawBody = JSON.stringify({
      guid: 'event-1',
      timestamp: '2026-08-09T10:00:00.000Z',
      eventType: 'order_updated',
    })
    const signature = toastWebhookSignature({
      rawBody,
      timestamp: '2026-08-09T10:00:00.000Z',
      webhookSecret: 'webhook-secret',
    })
    await expect(
      toast.verifyWebhook({
        rawBody,
        signature,
        receivedAt: new Date('2026-08-09T10:00:01.000Z'),
      }),
    ).resolves.toEqual({
      eventId: 'event-1',
      occurredAt: new Date('2026-08-09T10:00:00.000Z'),
    })
    expect(
      createHmac('sha256', 'webhook-secret')
        .update(rawBody + '2026-08-09T10:00:00.000Z')
        .digest('base64'),
    ).toBe(signature)
    await expect(
      toast.verifyWebhook({
        rawBody,
        signature: `A${signature.slice(1)}`,
        receivedAt: new Date('2026-08-09T10:00:01.000Z'),
      }),
    ).rejects.toThrow('signature is invalid')
  })

  it('surfaces revoked Toast credentials', async () => {
    const toast = connector(async () =>
      response({ error: 'unauthorized' }, 401),
    )
    await expect(
      toast.refreshTokens({ accessToken: 'old' }),
    ).rejects.toBeInstanceOf(ConnectorAuthorizationRevokedError)
  })
})
