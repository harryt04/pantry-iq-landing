import { createHmac, timingSafeEqual } from 'node:crypto'

import {
  resolveExactItemName,
  type ItemResolutionCandidate,
} from '@/src/server/ingestion/item-resolution'
import {
  ConnectorAuthorizationRevokedError,
  type ConnectorAdapter,
  type ConnectorAuthorization,
  type ConnectorPage,
  type ConnectorTokens,
  type ConnectorWebhook,
} from './types'

export const SQUARE_PROVIDER = 'square'
export const SQUARE_API_VERSION = '2026-07-15'
export const SQUARE_SCOPES = [
  'MERCHANT_PROFILE_READ',
  'ITEMS_READ',
  'ORDERS_READ',
] as const

const DEFAULT_API_BASE_URL = 'https://connect.squareup.com'
const DEFAULT_INCREMENTAL_LOOKBACK_DAYS = 7
const MONEY_EXPONENTS: Record<string, number> = {
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
}

type JsonObject = { [key: string]: unknown }
type SquareFetch = typeof fetch

export type SquareConnectorOptions = {
  clientId: string
  clientSecret: string
  webhookSignatureKey: string
  webhookUrl: string
  squareLocationId: string
  items: readonly ItemResolutionCandidate[]
  apiBaseUrl?: string
  incrementalLookbackDays?: number
  fetchImpl?: SquareFetch
}

export class SquarePayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SquarePayloadError'
  }
}

export class SquareItemResolutionError extends Error {
  readonly rawItemName: string

  constructor(rawItemName: string) {
    super(
      `Square item "${rawItemName}" does not exactly match an active PantryIQ item. Resolve it before syncing.`,
    )
    this.name = 'SquareItemResolutionError'
    this.rawItemName = rawItemName
  }
}

type CatalogItem = {
  name: string
  category: string | null
}

type CatalogObject = JsonObject & {
  id?: unknown
  type?: unknown
  item_data?: JsonObject
  item_variation_data?: JsonObject
}

type SquareOrder = JsonObject & {
  id?: unknown
  created_at?: unknown
  closed_at?: unknown
  line_items?: unknown
}

type IncrementalCursor = {
  apiCursor: string | null
  from: string
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new SquarePayloadError(`Square ${field} is missing.`)
  return value.trim()
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function dateValue(value: unknown, field: string): Date {
  const date = new Date(requiredString(value, field))
  if (Number.isNaN(date.getTime()))
    throw new SquarePayloadError(`Square ${field} is not a valid date.`)
  return date
}

function decimalQuantity(value: unknown): string {
  const quantity = requiredString(value, 'line item quantity')
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(quantity))
    throw new SquarePayloadError('Square line item quantity is not decimal.')
  return quantity
}

function moneyToDecimal(value: unknown, currency: string): string {
  const amount = requiredString(value, 'money amount')
  if (!/^-?\d+$/u.test(amount))
    throw new SquarePayloadError('Square money amount is not an integer.')

  const negative = amount.startsWith('-')
  const digits = (negative ? amount.slice(1) : amount).replace(/^0+(?=\d)/u, '')
  const exponent = MONEY_EXPONENTS[currency] ?? 2
  if (exponent === 0) return `${negative ? '-' : ''}${digits}`

  const padded = digits.padStart(exponent + 1, '0')
  const splitAt = padded.length - exponent
  const whole = padded.slice(0, splitAt)
  const fraction = padded.slice(splitAt).replace(/0+$/u, '')
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`
}

function catalogNameForObject(
  object: CatalogObject,
  categories: ReadonlyMap<string, string>,
): CatalogItem | null {
  if (object.type !== 'ITEM' || !object.item_data) return null
  const name = optionalString(object.item_data.name)
  if (!name) return null
  const categoryId = optionalString(object.item_data.category_id)
  return {
    name,
    category: categoryId ? (categories.get(categoryId) ?? null) : null,
  }
}

function catalogVariation(
  object: CatalogObject,
  items: Map<string, CatalogItem>,
  categories: ReadonlyMap<string, string>,
) {
  if (object.type && object.type !== 'ITEM_VARIATION') return
  if (!object.id) return
  const parentId = optionalString(object.item_variation_data?.item_id)
  const name = optionalString(object.item_variation_data?.name)
  if (!parentId || !name) return
  const parent = items.get(parentId)
  if (parent) items.set(String(object.id), parent)
  else items.set(String(object.id), { name, category: null })
  void categories
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function parseIncrementalCursor(value: string | null): IncrementalCursor {
  if (!value) {
    return { apiCursor: null, from: new Date().toISOString() }
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as JsonObject
    const apiCursor = parsed.apiCursor
    const from = parsed.from
    if (
      (apiCursor !== null && typeof apiCursor !== 'string') ||
      typeof from !== 'string'
    )
      throw new Error('invalid')
    dateValue(from, 'incremental cursor')
    return { apiCursor, from }
  } catch {
    throw new SquarePayloadError('The Square incremental cursor is invalid.')
  }
}

function parseJsonResponse(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new SquarePayloadError('Square returned an invalid JSON object.')
  return value as JsonObject
}

function responseError(response: Response, body: JsonObject): Error {
  if (response.status === 401 || response.status === 403)
    return new ConnectorAuthorizationRevokedError(
      'Square authorization is no longer valid. Reconnect Square to continue.',
    )
  const errors = Array.isArray(body.errors) ? body.errors : []
  const detail = errors
    .map((error) =>
      error && typeof error === 'object' && 'detail' in error
        ? String(error.detail)
        : '',
    )
    .filter(Boolean)
    .join('; ')
  return new Error(
    `Square API request failed (${response.status}).${detail ? ` ${detail}` : ''}`,
  )
}

function verifySquareSignature(
  rawBody: string,
  signature: string | null,
  webhookUrl: string,
  signatureKey: string,
): boolean {
  if (!signature || !signatureKey) return false
  const expected = createHmac('sha256', signatureKey)
    .update(webhookUrl + rawBody)
    .digest()
  const supplied = Buffer.from(signature, 'base64')
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  )
}

export function createSquareConnector(
  options: SquareConnectorOptions,
): ConnectorAdapter {
  if (!options.clientId.trim() || !options.clientSecret.trim())
    throw new Error('Square OAuth client credentials are required.')
  if (!options.squareLocationId.trim())
    throw new Error('The Square location ID is required.')
  if (!options.items.length)
    throw new Error(
      'At least one PantryIQ item is required for Square resolution.',
    )
  const requestedLookbackDays =
    options.incrementalLookbackDays ?? DEFAULT_INCREMENTAL_LOOKBACK_DAYS
  if (!Number.isInteger(requestedLookbackDays) || requestedLookbackDays < 1)
    throw new Error('Square incremental lookback must be a positive integer.')

  const fetchImpl = options.fetchImpl ?? fetch
  const apiBaseUrl = (
    options.apiBaseUrl ??
    process.env.SQUARE_API_BASE_URL ??
    DEFAULT_API_BASE_URL
  ).replace(/\/$/u, '')
  const lookbackDays = requestedLookbackDays
  let catalogPromise: Promise<ReadonlyMap<string, CatalogItem>> | null = null

  async function request(
    path: string,
    tokens: ConnectorTokens | null,
    init: RequestInit = {},
  ): Promise<JsonObject> {
    const response = await fetchImpl(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
        'Content-Type': 'application/json',
        'Square-Version': SQUARE_API_VERSION,
        ...init.headers,
      },
    })
    const body = parseJsonResponse(await response.json())
    if (!response.ok) throw responseError(response, body)
    if (Array.isArray(body.errors) && body.errors.length)
      throw responseError(response, body)
    return body
  }

  async function loadCatalog(
    tokens: ConnectorTokens,
  ): Promise<ReadonlyMap<string, CatalogItem>> {
    const items = new Map<string, CatalogItem>()
    const categories = new Map<string, string>()
    let cursor: string | null = null
    do {
      const query = new URLSearchParams({
        types: 'ITEM,ITEM_VARIATION,CATEGORY',
      })
      if (cursor) query.set('cursor', cursor)
      const body = await request(`/v2/catalog/list?${query.toString()}`, tokens)
      const objects = Array.isArray(body.objects) ? body.objects : []
      for (const value of objects) {
        if (!value || typeof value !== 'object') continue
        const object = value as CatalogObject
        if (object.type === 'CATEGORY' && object.id) {
          const name = optionalString(
            (object as JsonObject).category_data &&
              typeof (object as JsonObject).category_data === 'object'
              ? ((object as JsonObject).category_data as JsonObject).name
              : null,
          )
          if (name) categories.set(String(object.id), name)
        }
      }
      for (const value of objects) {
        if (!value || typeof value !== 'object') continue
        const object = value as CatalogObject
        const item = catalogNameForObject(object, categories)
        if (item && object.id) {
          items.set(String(object.id), item)
          const variations = object.item_data?.variations
          if (Array.isArray(variations)) {
            for (const variation of variations) {
              if (variation && typeof variation === 'object') {
                catalogVariation(variation as CatalogObject, items, categories)
              }
            }
          }
        }
        catalogVariation(object, items, categories)
      }
      cursor = optionalString(body.cursor)
    } while (cursor)
    return items
  }

  async function catalog(tokens: ConnectorTokens) {
    catalogPromise ??= loadCatalog(tokens)
    return catalogPromise
  }

  function resolveItem(rawItemName: string, catalogItem: CatalogItem | null) {
    const name = catalogItem?.name ?? rawItemName
    const resolution = resolveExactItemName(name, options.items)
    if (resolution.status !== 'matched')
      throw new SquareItemResolutionError(rawItemName)
    return resolution.item
  }

  function orderRecords(
    order: SquareOrder,
    catalogItems: ReadonlyMap<string, CatalogItem>,
  ) {
    const orderId = requiredString(order.id, 'order ID')
    const transactedAt = dateValue(
      order.closed_at ?? order.created_at,
      'order date',
    )
    if (!Array.isArray(order.line_items)) return []
    return order.line_items.map((value, index) => {
      if (!value || typeof value !== 'object')
        throw new SquarePayloadError('Square order line item is invalid.')
      const line = value as JsonObject
      const catalogObjectId = optionalString(line.catalog_object_id)
      const catalogItem = catalogObjectId
        ? (catalogItems.get(catalogObjectId) ?? null)
        : null
      const rawItemName = optionalString(line.name) ?? catalogItem?.name
      if (!rawItemName)
        throw new SquarePayloadError('Square line item has no name.')
      const item = resolveItem(rawItemName, catalogItem)
      const quantity = decimalQuantity(line.quantity)
      const money = (line.total_money ?? line.gross_sales_money) as
        JsonObject | undefined
      const currency = requiredString(money?.currency, 'line item currency')
      const totalRevenue = moneyToDecimal(money?.amount, currency)
      const priceMoney = line.base_price_money as JsonObject | undefined
      const unitPrice = priceMoney
        ? moneyToDecimal(
            priceMoney.amount,
            requiredString(priceMoney.currency, 'line item price currency'),
          )
        : quantity === '1'
          ? totalRevenue
          : (() => {
              throw new SquarePayloadError(
                'Square line item has no unit price.',
              )
            })()
      return {
        kind: 'transaction' as const,
        source: SQUARE_PROVIDER,
        externalId: `${orderId}:${optionalString(line.uid) ?? index}`,
        transactedAt,
        itemId: item.id,
        rawItemName,
        category: item.category,
        qty: quantity,
        unitPrice,
        totalRevenue,
        totalCost: null,
        grossMargin: null,
      }
    })
  }

  async function orders(
    tokens: ConnectorTokens,
    cursor: string | null,
    from: string | null,
  ) {
    const query: JsonObject = {
      filter: {
        state_filter: { states: ['COMPLETED'] },
        ...(from
          ? { date_time_filter: { closed_at: { start_at: from } } }
          : {}),
      },
      sort: { sort_field: 'CLOSED_AT', sort_order: 'ASC' },
    }
    const body = await request('/v2/orders/search', tokens, {
      method: 'POST',
      body: JSON.stringify({
        location_ids: [options.squareLocationId],
        limit: 500,
        ...(cursor ? { cursor } : {}),
        query,
      }),
    })
    const catalogItems = await catalog(tokens)
    const orderValues = Array.isArray(body.orders) ? body.orders : []
    const records = orderValues.flatMap((value) => {
      if (!value || typeof value !== 'object')
        throw new SquarePayloadError('Square order is invalid.')
      return orderRecords(value as SquareOrder, catalogItems)
    })
    const nextCursor = optionalString(body.cursor)
    return { records, nextCursor }
  }

  return {
    provider: SQUARE_PROVIDER,

    authorizationUrl(input) {
      const url = new URL('/oauth2/authorize', apiBaseUrl)
      url.searchParams.set('client_id', options.clientId)
      url.searchParams.set('scope', SQUARE_SCOPES.join(' '))
      url.searchParams.set('session', 'true')
      url.searchParams.set('state', input.state)
      url.searchParams.set('redirect_uri', input.redirectUri)
      return url.toString()
    },

    async exchangeCode(input): Promise<ConnectorAuthorization> {
      const body = await request('/oauth2/token', null, {
        method: 'POST',
        body: JSON.stringify({
          client_id: options.clientId,
          client_secret: options.clientSecret,
          code: input.code,
          grant_type: 'authorization_code',
          redirect_uri: input.redirectUri,
        }),
      })
      const accessToken = requiredString(body.access_token, 'access token')
      const providerAccountId = optionalString(body.merchant_id)
      return {
        ...(providerAccountId ? { providerAccountId } : {}),
        tokens: {
          accessToken,
          ...(optionalString(body.refresh_token)
            ? { refreshToken: optionalString(body.refresh_token)! }
            : {}),
          ...(body.expires_at
            ? {
                accessTokenExpiresAt: dateValue(
                  body.expires_at,
                  'token expiration',
                ),
              }
            : {}),
          ...(optionalString(body.scope)
            ? { scope: optionalString(body.scope)! }
            : {}),
        },
      }
    },

    async refreshTokens(tokens) {
      const refreshToken = tokens.refreshToken
      if (!refreshToken)
        throw new ConnectorAuthorizationRevokedError(
          'Square did not return a refresh token.',
        )
      const body = await request('/oauth2/token', null, {
        method: 'POST',
        body: JSON.stringify({
          client_id: options.clientId,
          client_secret: options.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })
      const accessTokenExpiresAt = body.expires_at
        ? dateValue(body.expires_at, 'token expiration')
        : undefined
      const scope = optionalString(body.scope)
      return {
        accessToken: requiredString(body.access_token, 'access token'),
        refreshToken: optionalString(body.refresh_token) ?? refreshToken,
        ...(accessTokenExpiresAt ? { accessTokenExpiresAt } : {}),
        ...((scope ?? tokens.scope) ? { scope: scope ?? tokens.scope } : {}),
      }
    },

    async backfill({ tokens, cursor }): Promise<ConnectorPage> {
      const page = await orders(tokens, cursor, null)
      return {
        records: page.records,
        nextCursor: page.nextCursor,
        complete: page.nextCursor === null,
      }
    },

    async incremental({ tokens, cursor }): Promise<ConnectorPage> {
      const parsed = parseIncrementalCursor(cursor)
      if (!cursor) {
        const from = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
        parsed.from = from.toISOString()
      }
      const page = await orders(tokens, parsed.apiCursor, parsed.from)
      const nextCursor = page.nextCursor
        ? base64UrlEncode(
            JSON.stringify({ apiCursor: page.nextCursor, from: parsed.from }),
          )
        : null
      return {
        records: page.records,
        nextCursor,
        complete: nextCursor === null,
      }
    },

    async verifyWebhook(input): Promise<ConnectorWebhook> {
      if (
        !verifySquareSignature(
          input.rawBody,
          input.signature,
          options.webhookUrl,
          options.webhookSignatureKey,
        )
      )
        throw new Error('The Square webhook signature is invalid.')
      let body: JsonObject
      try {
        body = parseJsonResponse(JSON.parse(input.rawBody))
      } catch {
        throw new SquarePayloadError('The Square webhook body is invalid.')
      }
      return {
        eventId: requiredString(body.event_id, 'webhook event ID'),
        occurredAt: dateValue(body.created_at, 'webhook timestamp'),
      }
    },
  }
}

export function squareWebhookSignature(input: {
  rawBody: string
  webhookUrl: string
  signatureKey: string
}): string {
  return createHmac('sha256', input.signatureKey)
    .update(input.webhookUrl + input.rawBody)
    .digest('base64')
}
