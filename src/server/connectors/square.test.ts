import { createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  createSquareConnector,
  squareWebhookSignature,
  SquareItemResolutionError,
} from './square'
import { ConnectorAuthorizationRevokedError } from './types'

const webhookUrl = 'https://pantryiq.test/api/connectors/square/webhook'
const item = {
  id: '11111111-1111-4111-8111-111111111111',
  canonicalName: 'Salmon',
  displayName: 'Salmon',
  category: 'protein',
  unit: 'lb',
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function connector(fetchImpl: typeof fetch) {
  return createSquareConnector({
    clientId: 'square-client',
    clientSecret: 'square-secret',
    webhookSignatureKey: 'webhook-secret',
    webhookUrl,
    squareLocationId: 'SQUARE_LOCATION',
    items: [item],
    apiBaseUrl: 'https://square.test',
    fetchImpl,
  })
}

describe('Square connector', () => {
  it('builds a scoped OAuth URL and exchanges a code without exposing tokens in the URL', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const square = connector(async (input, init) => {
      calls.push(init ? { url: String(input), init } : { url: String(input) })
      return response({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: '2026-08-10T12:00:00.000Z',
        merchant_id: 'MERCHANT',
      })
    })

    const url = new URL(
      square.authorizationUrl({
        state: 'state-value',
        redirectUri: webhookUrl,
      }),
    )
    expect(url.pathname).toBe('/oauth2/authorize')
    expect(url.searchParams.get('state')).toBe('state-value')
    expect(url.searchParams.get('scope')).toContain('ITEMS_READ')
    expect(url.searchParams.get('client_id')).toBe('square-client')
    expect(url.toString()).not.toContain('access-token')

    await expect(
      square.exchangeCode({ code: 'one-time-code', redirectUri: webhookUrl }),
    ).resolves.toMatchObject({
      providerAccountId: 'MERCHANT',
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
    })
    expect(calls[0]?.url).toBe('https://square.test/oauth2/token')
    expect(calls[0]?.init?.headers).not.toHaveProperty('Authorization')
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({
      grant_type: 'authorization_code',
      code: 'one-time-code',
    })
  })

  it('normalizes catalog-backed orders through exact item resolution', async () => {
    const calls: string[] = []
    const square = connector(async (input) => {
      const url = String(input)
      calls.push(url)
      if (
        url.endsWith('/v2/catalog/list?types=ITEM%2CITEM_VARIATION%2CCATEGORY')
      )
        return response({
          objects: [
            {
              type: 'ITEM',
              id: 'CATALOG_ITEM',
              item_data: {
                name: 'Salmon',
                variations: [
                  {
                    id: 'CATALOG_VARIATION',
                    item_variation_data: {
                      name: '6 oz',
                      item_id: 'CATALOG_ITEM',
                    },
                  },
                ],
              },
            },
          ],
        })
      if (url.endsWith('/v2/orders/search'))
        return response({
          orders: [
            {
              id: 'ORDER-1',
              closed_at: '2026-08-09T01:15:00.000Z',
              line_items: [
                {
                  uid: 'LINE-1',
                  catalog_object_id: 'CATALOG_VARIATION',
                  name: 'Salmon',
                  quantity: '2',
                  base_price_money: { amount: '1250', currency: 'USD' },
                  total_money: { amount: '2500', currency: 'USD' },
                },
              ],
            },
          ],
        })
      throw new Error(`Unexpected Square request: ${url}`)
    })

    await expect(
      square.backfill({
        tokens: { accessToken: 'access-token' },
        cursor: null,
      }),
    ).resolves.toEqual({
      records: [
        {
          kind: 'transaction',
          source: 'square',
          externalId: 'ORDER-1:LINE-1',
          transactedAt: new Date('2026-08-09T01:15:00.000Z'),
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
      nextCursor: null,
      complete: true,
    })
    expect(calls).toHaveLength(2)
  })

  it('uses an encoded, resumable incremental cursor and deduplicable source IDs', async () => {
    const requests: Array<{ url: string; body: JsonObject }> = []
    const square = connector(async (input, init) => {
      const url = String(input)
      if (url.includes('/v2/catalog/list')) return response({ objects: [] })
      const body = JSON.parse(String(init?.body)) as JsonObject
      requests.push({ url, body })
      return response({ orders: [], cursor: 'square-cursor-2' })
    })

    const first = await square.incremental({
      tokens: { accessToken: 'access-token' },
      cursor: null,
    })
    expect(first.complete).toBe(false)
    expect(first.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/u)
    expect(requests[0]?.body).toMatchObject({
      location_ids: ['SQUARE_LOCATION'],
      query: { filter: { state_filter: { states: ['COMPLETED'] } } },
    })
    expect((requests[0]?.body.query as JsonObject).filter).toHaveProperty(
      'date_time_filter',
    )

    await square.incremental({
      tokens: { accessToken: 'access-token' },
      cursor: first.nextCursor,
    })
    expect(requests[1]?.body.cursor).toBe('square-cursor-2')
  })

  it('rejects unmatched catalog names instead of guessing', async () => {
    const square = connector(async (input) => {
      if (String(input).includes('/v2/catalog/list'))
        return response({
          objects: [
            {
              type: 'ITEM',
              id: 'CATALOG_ITEM',
              item_data: { name: 'Unknown Fish' },
            },
          ],
        })
      return response({
        orders: [
          {
            id: 'ORDER-1',
            closed_at: '2026-08-09T01:15:00.000Z',
            line_items: [
              {
                catalog_object_id: 'CATALOG_ITEM',
                quantity: '1',
                total_money: { amount: '100', currency: 'USD' },
              },
            ],
          },
        ],
      })
    })

    await expect(
      square.backfill({
        tokens: { accessToken: 'access-token' },
        cursor: null,
      }),
    ).rejects.toBeInstanceOf(SquareItemResolutionError)
  })

  it('verifies Square webhook signatures over URL plus raw body', async () => {
    const square = connector(async () => response({}))
    const rawBody = JSON.stringify({
      event_id: 'event-1',
      created_at: '2026-08-09T10:00:00.000Z',
    })
    const signature = squareWebhookSignature({
      rawBody,
      webhookUrl,
      signatureKey: 'webhook-secret',
    })
    await expect(
      square.verifyWebhook({ rawBody, signature, receivedAt: new Date() }),
    ).resolves.toEqual({
      eventId: 'event-1',
      occurredAt: new Date('2026-08-09T10:00:00.000Z'),
    })
    await expect(
      square.verifyWebhook({
        rawBody,
        signature: `A${signature.slice(1)}`,
        receivedAt: new Date(),
      }),
    ).rejects.toThrow('signature is invalid')
    expect(
      createHmac('sha256', 'webhook-secret')
        .update(webhookUrl + rawBody)
        .digest('base64'),
    ).toBe(signature)
  })

  it('surfaces revoked Square credentials for the framework retry policy', async () => {
    const square = connector(async () =>
      response({ errors: [{ detail: 'unauthorized' }] }, 401),
    )
    await expect(
      square.refreshTokens({ accessToken: 'old', refreshToken: 'refresh' }),
    ).rejects.toBeInstanceOf(ConnectorAuthorizationRevokedError)
  })
})

type JsonObject = { [key: string]: unknown }
