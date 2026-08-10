import { describe, expect, it } from 'vitest'

import {
  createQuickBooksConnector,
  quickBooksWebhookSignature,
  QuickBooksCurrencyError,
  QuickBooksItemResolutionError,
  QuickBooksTaxError,
} from './quickbooks'
import { ConnectorAuthorizationRevokedError } from './types'

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

function bill(overrides: Record<string, unknown> = {}) {
  return {
    Id: 'BILL-1',
    TxnDate: '2026-08-08',
    CurrencyRef: { value: 'USD', name: 'United States Dollar' },
    GlobalTaxCalculation: 'TaxExcluded',
    VendorRef: { value: 'VENDOR-1', name: 'Fresh Foods' },
    Line: [
      {
        Id: '1',
        Amount: '25.00',
        DetailType: 'ItemBasedExpenseLineDetail',
        ItemBasedExpenseLineDetail: {
          ItemRef: { value: 'ITEM-1', name: 'Salmon' },
          Qty: '2',
          UnitPrice: '12.50',
          TaxCodeRef: { value: 'NON' },
        },
      },
    ],
    ...overrides,
  }
}

function connector(
  fetchImpl: typeof fetch,
  overrides: Record<string, unknown> = {},
) {
  return createQuickBooksConnector({
    clientId: 'quickbooks-client',
    clientSecret: 'quickbooks-secret',
    verifierToken: 'verifier-token',
    currencyCode: 'USD',
    taxMode: 'exclude',
    realmId: 'REALM-1',
    items: [item],
    apiBaseUrl: 'https://quickbooks.test',
    oauthBaseUrl: 'https://oauth.test',
    fetchImpl,
    ...overrides,
  })
}

describe('QuickBooks connector', () => {
  it('builds the accounting OAuth URL and exchanges a code without putting secrets in the URL', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const quickbooks = connector(async (input, init) => {
      calls.push({ url: String(input), ...(init ? { init } : {}) })
      return response({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        scope: 'com.intuit.quickbooks.accounting',
      })
    })

    const url = new URL(
      quickbooks.authorizationUrl({
        state: 'state-value',
        redirectUri: 'https://pantryiq.test/api/connectors/quickbooks/callback',
      }),
    )
    expect(url.origin).toBe('https://appcenter.intuit.com')
    expect(url.pathname).toBe('/connect/oauth2')
    expect(url.searchParams.get('scope')).toBe(
      'com.intuit.quickbooks.accounting',
    )
    expect(url.searchParams.get('state')).toBe('state-value')
    expect(url.toString()).not.toContain('quickbooks-secret')

    await expect(
      quickbooks.exchangeCode({
        code: 'one-time-code',
        redirectUri: 'https://pantryiq.test/callback',
        providerAccountId: 'REALM-FROM-CALLBACK',
      }),
    ).resolves.toMatchObject({
      providerAccountId: 'REALM-FROM-CALLBACK',
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
    })
    expect(calls[0]?.url).toBe('https://oauth.test/oauth2/v1/tokens/bearer')
    expect(calls[0]?.init?.headers).toMatchObject({
      'Content-Type': 'application/x-www-form-urlencoded',
    })
    expect(String(calls[0]?.init?.body)).toContain(
      'grant_type=authorization_code',
    )
    expect(String(calls[0]?.init?.body)).not.toContain('quickbooks-secret')
  })

  it('normalizes supplier bills into exact purchase-order costs and maps the vendor name', async () => {
    const quickbooks = connector(async (input) => {
      expect(String(input)).toContain('/v3/company/REALM-1/query?query=')
      return response({ QueryResponse: { Bill: [bill()] } })
    })

    await expect(
      quickbooks.backfill({
        tokens: { accessToken: 'access-token' },
        cursor: null,
      }),
    ).resolves.toMatchObject({
      records: [
        {
          kind: 'purchase_order',
          source: 'quickbooks',
          externalId: 'BILL-1',
          orderedAt: new Date('2026-08-08T00:00:00.000Z'),
          supplierName: 'Fresh Foods',
          lines: [
            {
              itemId: item.id,
              rawItemName: 'Salmon',
              qty: '2',
              unitCost: '12.50',
              totalCost: '25.00',
            },
          ],
        },
      ],
      complete: true,
    })
  })

  it('uses the QuickBooks reference queries when bill refs omit names', async () => {
    const requests: string[] = []
    const quickbooks = connector(async (input) => {
      const url = String(input)
      requests.push(url)
      if (url.includes('SELECT%20*%20FROM%20Item'))
        return response({
          QueryResponse: { Item: [{ Id: 'ITEM-1', Name: 'Salmon' }] },
        })
      if (url.includes('SELECT%20*%20FROM%20Vendor'))
        return response({
          QueryResponse: {
            Vendor: [{ Id: 'VENDOR-1', DisplayName: 'Fresh Foods' }],
          },
        })
      return response({
        QueryResponse: {
          Bill: [
            bill({
              VendorRef: { value: 'VENDOR-1' },
              Line: [
                {
                  Amount: '25.00',
                  DetailType: 'ItemBasedExpenseLineDetail',
                  ItemBasedExpenseLineDetail: {
                    ItemRef: { value: 'ITEM-1' },
                    Qty: '2',
                    UnitPrice: '12.50',
                  },
                },
              ],
            }),
          ],
        },
      })
    })

    await expect(
      quickbooks.backfill({
        tokens: { accessToken: 'access-token' },
        cursor: null,
      }),
    ).resolves.toMatchObject({ records: [{ supplierName: 'Fresh Foods' }] })
    expect(
      requests.some((url) => url.includes('SELECT%20*%20FROM%20Item')),
    ).toBe(true)
    expect(
      requests.some((url) => url.includes('SELECT%20*%20FROM%20Vendor')),
    ).toBe(true)
  })

  it('rejects currency and tax policy mismatches instead of silently converting costs', async () => {
    const currencyConnector = connector(async () =>
      response({
        QueryResponse: { Bill: [bill({ CurrencyRef: { value: 'CAD' } })] },
      }),
    )
    await expect(
      currencyConnector.backfill({
        tokens: { accessToken: 'access-token' },
        cursor: null,
      }),
    ).rejects.toBeInstanceOf(QuickBooksCurrencyError)

    const taxConnector = connector(async () =>
      response({
        QueryResponse: {
          Bill: [bill({ GlobalTaxCalculation: 'TaxInclusive' })],
        },
      }),
    )
    await expect(
      taxConnector.backfill({
        tokens: { accessToken: 'access-token' },
        cursor: null,
      }),
    ).rejects.toBeInstanceOf(QuickBooksTaxError)
  })

  it('fails closed on an unresolved item and returns a resumable page cursor', async () => {
    const unmatched = connector(async () =>
      response({
        QueryResponse: {
          Bill: [
            bill({
              Line: [
                {
                  Amount: '25.00',
                  DetailType: 'ItemBasedExpenseLineDetail',
                  ItemBasedExpenseLineDetail: {
                    ItemRef: { value: 'ITEM-1', name: 'Unknown Fish' },
                    Qty: '1',
                    UnitPrice: '25.00',
                  },
                },
              ],
            }),
          ],
        },
      }),
    )
    await expect(
      unmatched.backfill({
        tokens: { accessToken: 'access-token' },
        cursor: null,
      }),
    ).rejects.toBeInstanceOf(QuickBooksItemResolutionError)

    const pageBills = Array.from({ length: 100 }, (_, index) =>
      bill({ Id: `BILL-${index}` }),
    )
    let calls = 0
    const paged = connector(async () => {
      calls += 1
      return response({ QueryResponse: { Bill: calls === 1 ? pageBills : [] } })
    })
    const first = await paged.backfill({
      tokens: { accessToken: 'access-token' },
      cursor: null,
    })
    expect(first.complete).toBe(false)
    expect(first.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/u)
    await expect(
      paged.backfill({
        tokens: { accessToken: 'access-token' },
        cursor: first.nextCursor,
      }),
    ).resolves.toMatchObject({ complete: true, records: [] })
  })

  it('verifies QuickBooks webhook signatures over the raw body and identifies bill changes', async () => {
    const quickbooks = connector(async () => response({}))
    const rawBody = JSON.stringify({
      eventNotifications: [
        {
          realmId: 'REALM-1',
          dataChangeEvent: {
            entities: [
              {
                name: 'Bill',
                id: 'BILL-1',
                operation: 'Update',
                lastUpdated: '2026-08-09T10:00:00.000Z',
              },
            ],
          },
        },
      ],
    })
    const signature = quickBooksWebhookSignature({
      rawBody,
      verifierToken: 'verifier-token',
    })
    await expect(
      quickbooks.verifyWebhook({
        rawBody,
        signature,
        receivedAt: new Date('2026-08-09T10:00:01.000Z'),
      }),
    ).resolves.toEqual({
      eventId: 'REALM-1:Bill:BILL-1:Update:2026-08-09T10:00:00.000Z',
      occurredAt: new Date('2026-08-09T10:00:00.000Z'),
    })
    await expect(
      quickbooks.verifyWebhook({
        rawBody,
        signature: `A${signature.slice(1)}`,
        receivedAt: new Date(),
      }),
    ).rejects.toThrow('signature is invalid')
  })

  it('surfaces revoked credentials for the shared retry policy', async () => {
    const quickbooks = connector(async () =>
      response({ Fault: { Error: [{ Detail: 'unauthorized' }] } }, 401),
    )
    await expect(
      quickbooks.refreshTokens({ accessToken: 'old', refreshToken: 'refresh' }),
    ).rejects.toBeInstanceOf(ConnectorAuthorizationRevokedError)
  })
})
