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

export const TOAST_PROVIDER = 'toast'
export const TOAST_SCOPES = ['orders:read', 'menus:read'] as const

const DEFAULT_API_BASE_URL = 'https://toast-api-server'
const DEFAULT_BACKFILL_DAYS = 365
const DEFAULT_WINDOW_DAYS = 30
const DEFAULT_INCREMENTAL_LOOKBACK_DAYS = 7
const PAGE_SIZE = 100

type JsonObject = { [key: string]: unknown }
type ToastFetch = typeof fetch

export type ToastConnectorOptions = {
  clientId: string
  clientSecret: string
  restaurantExternalId: string
  webhookSecret: string
  webhookUrl: string
  items: readonly ItemResolutionCandidate[]
  apiBaseUrl?: string
  backfillDays?: number
  backfillWindowDays?: number
  incrementalLookbackDays?: number
  fetchImpl?: ToastFetch
}

export class ToastPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ToastPayloadError'
  }
}

export class ToastItemResolutionError extends Error {
  readonly rawItemName: string

  constructor(rawItemName: string) {
    super(
      `Toast item "${rawItemName}" does not exactly match an active PantryIQ item. Resolve it before syncing.`,
    )
    this.name = 'ToastItemResolutionError'
    this.rawItemName = rawItemName
  }
}

type Cursor = {
  from: string
  to: string
  page: number
  mode: 'backfill' | 'incremental'
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new ToastPayloadError(`Toast ${field} is missing.`)
  return value.trim()
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function dateValue(value: unknown, field: string): Date {
  const input = requiredString(value, field)
  const date = new Date(input)
  if (Number.isNaN(date.getTime()))
    throw new ToastPayloadError(`Toast ${field} is not a valid date.`)
  return date
}

function decimalValue(value: unknown, field: string): string {
  const input =
    typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : requiredString(value, field)
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(input))
    throw new ToastPayloadError(`Toast ${field} is not decimal.`)
  return input
}

function decimalProduct(left: string, right: string): string {
  const leftParts = left.replace('-', '').split('.')
  const rightParts = right.replace('-', '').split('.')
  const leftScale = leftParts[1]?.length ?? 0
  const rightScale = rightParts[1]?.length ?? 0
  const leftInteger = BigInt(`${leftParts[0]}${leftParts[1] ?? ''}`)
  const rightInteger = BigInt(`${rightParts[0]}${rightParts[1] ?? ''}`)
  const negative = left.startsWith('-') !== right.startsWith('-')
  const scale = leftScale + rightScale
  const product = (negative ? -1n : 1n) * leftInteger * rightInteger
  if (scale === 0) return product.toString()
  const sign = product < 0n ? '-' : ''
  const digits = (product < 0n ? -product : product)
    .toString()
    .padStart(scale + 1, '0')
  const whole = digits.slice(0, -scale) || '0'
  const fraction = digits.slice(-scale).replace(/0+$/u, '')
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

function decodeCursor(value: string | null): Cursor | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as JsonObject
    if (
      (parsed.mode !== 'backfill' && parsed.mode !== 'incremental') ||
      typeof parsed.from !== 'string' ||
      typeof parsed.to !== 'string' ||
      !Number.isInteger(parsed.page) ||
      (parsed.page as number) < 1
    )
      throw new Error('invalid')
    dateValue(parsed.from, 'sync cursor start')
    dateValue(parsed.to, 'sync cursor end')
    return {
      mode: parsed.mode,
      from: parsed.from,
      to: parsed.to,
      page: parsed.page as number,
    }
  } catch {
    throw new ToastPayloadError('The Toast sync cursor is invalid.')
  }
}

function parseJson(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ToastPayloadError('Toast returned an invalid JSON object.')
  return value as JsonObject
}

function errorForResponse(response: Response, body: unknown): Error {
  if (response.status === 401 || response.status === 403)
    return new ConnectorAuthorizationRevokedError(
      'Toast authorization is no longer valid. Reconnect Toast to continue.',
    )
  const parsed = body && typeof body === 'object' ? (body as JsonObject) : {}
  const detail =
    optionalString(parsed.message) ?? optionalString(parsed.error) ?? null
  return new Error(
    `Toast API request failed (${response.status}).${detail ? ` ${detail}` : ''}`,
  )
}

function verifyToastSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false
  const expected = createHmac('sha256', secret)
    .update(rawBody + timestamp)
    .digest()
  const supplied = Buffer.from(signature, 'base64')
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  )
}

function menuItemName(value: unknown): { id: string; name: string } | null {
  if (!value || typeof value !== 'object') return null
  const item = value as JsonObject
  const id = optionalString(item.guid)
  const name = optionalString(item.name)
  return id && name ? { id, name } : null
}

export function createToastConnector(
  options: ToastConnectorOptions,
): ConnectorAdapter {
  if (!options.clientId.trim() || !options.clientSecret.trim())
    throw new Error('Toast client credentials are required.')
  if (!options.restaurantExternalId.trim())
    throw new Error('The Toast restaurant external ID is required.')
  if (!options.webhookSecret.trim())
    throw new Error('The Toast webhook secret is required.')
  if (!options.webhookUrl.trim())
    throw new Error('The Toast webhook URL is required.')
  if (!options.items.length)
    throw new Error(
      'At least one PantryIQ item is required for Toast resolution.',
    )

  const backfillDays = options.backfillDays ?? DEFAULT_BACKFILL_DAYS
  const backfillWindowDays = options.backfillWindowDays ?? DEFAULT_WINDOW_DAYS
  const incrementalLookbackDays =
    options.incrementalLookbackDays ?? DEFAULT_INCREMENTAL_LOOKBACK_DAYS
  for (const [name, value] of [
    ['backfill days', backfillDays],
    ['backfill window days', backfillWindowDays],
    ['incremental lookback days', incrementalLookbackDays],
  ] as const) {
    if (!Number.isInteger(value) || value < 1)
      throw new Error(`Toast ${name} must be a positive integer.`)
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const apiBaseUrl = (
    options.apiBaseUrl ??
    process.env.TOAST_API_BASE_URL ??
    DEFAULT_API_BASE_URL
  ).replace(/\/$/u, '')
  let menuPromise: Promise<ReadonlyMap<string, string>> | null = null

  async function request(
    path: string,
    tokens: ConnectorTokens | null,
    init: RequestInit = {},
  ): Promise<{ body: unknown; response: Response }> {
    const response = await fetchImpl(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
        'Content-Type': 'application/json',
        'Toast-Restaurant-External-ID': options.restaurantExternalId,
        ...init.headers,
      },
    })
    const body = await response.json()
    if (!response.ok) throw errorForResponse(response, body)
    return { body, response }
  }

  async function authenticate(): Promise<ConnectorAuthorization> {
    const { body } = await request(
      '/authentication/v1/authentication/login',
      null,
      {
        method: 'POST',
        body: JSON.stringify({
          clientId: options.clientId,
          clientSecret: options.clientSecret,
          userAccessType: 'TOAST_MACHINE_CLIENT',
        }),
      },
    )
    const response = parseJson(body)
    const token = parseJson(response.token)
    const accessToken = requiredString(token.accessToken, 'access token')
    const expiresIn = token.expiresIn
    if (
      typeof expiresIn !== 'number' ||
      !Number.isInteger(expiresIn) ||
      expiresIn < 1
    )
      throw new ToastPayloadError('Toast token expiration is missing.')
    return {
      providerAccountId: options.restaurantExternalId,
      tokens: {
        accessToken,
        accessTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        ...(optionalString(token.refreshToken)
          ? { refreshToken: optionalString(token.refreshToken)! }
          : {}),
        ...(optionalString(token.scope)
          ? { scope: optionalString(token.scope)! }
          : {}),
      },
    }
  }

  async function loadMenu(tokens: ConnectorTokens) {
    const items = new Map<string, string>()
    let pageToken: string | null = null
    do {
      const query = new URLSearchParams()
      if (pageToken) query.set('pageToken', pageToken)
      const path = `/config/v2/menuItems${query.size ? `?${query}` : ''}`
      const { body, response } = await request(path, tokens)
      if (!Array.isArray(body))
        throw new ToastPayloadError('Toast menu response is invalid.')
      for (const value of body) {
        const item = menuItemName(value)
        if (item) items.set(item.id, item.name)
      }
      pageToken = response.headers.get('Toast-Next-Page-Token')
    } while (pageToken)
    return items
  }

  async function menu(tokens: ConnectorTokens) {
    menuPromise ??= loadMenu(tokens)
    return menuPromise
  }

  function resolveItem(rawItemName: string) {
    const resolution = resolveExactItemName(rawItemName, options.items)
    if (resolution.status !== 'matched')
      throw new ToastItemResolutionError(rawItemName)
    return resolution.item
  }

  function orderRecords(
    order: JsonObject,
    menuItems: ReadonlyMap<string, string>,
  ) {
    const orderId = requiredString(order.guid, 'order GUID')
    if (order.voided === true || order.deletedDate) return []
    const checks = Array.isArray(order.checks) ? order.checks : []
    return checks
      .flatMap((checkValue) => {
        if (!checkValue || typeof checkValue !== 'object')
          throw new ToastPayloadError('Toast order check is invalid.')
        const check = checkValue as JsonObject
        const selections = Array.isArray(check.selections)
          ? check.selections
          : []
        return selections.map((selectionValue, index) => {
          if (!selectionValue || typeof selectionValue !== 'object')
            throw new ToastPayloadError('Toast order selection is invalid.')
          const selection = selectionValue as JsonObject
          if (selection.voided === true || selection.deletedDate) return null
          const itemReference = parseJson(selection.item)
          const itemId = optionalString(itemReference.guid)
          const displayName = optionalString(selection.displayName)
          const rawItemName =
            (itemId ? menuItems.get(itemId) : null) ?? displayName
          if (!rawItemName)
            throw new ToastPayloadError('Toast selection has no item name.')
          const item = resolveItem(rawItemName)
          const qty = decimalValue(selection.quantity, 'selection quantity')
          const unitPrice = decimalValue(selection.price, 'selection price')
          const transactedAt = dateValue(
            selection.createdDate ??
              check.closedDate ??
              order.closedDate ??
              order.modifiedDate ??
              order.openedDate,
            'order date',
          )
          const selectionId = optionalString(selection.guid) ?? String(index)
          return {
            kind: 'transaction' as const,
            source: TOAST_PROVIDER,
            externalId: `${orderId}:${selectionId}`,
            transactedAt,
            itemId: item.id,
            rawItemName,
            category: item.category,
            qty,
            unitPrice,
            totalRevenue: decimalProduct(qty, unitPrice),
            totalCost: null,
            grossMargin: null,
          }
        })
      })
      .filter((record): record is NonNullable<typeof record> => record !== null)
  }

  async function orders(tokens: ConnectorTokens, cursor: Cursor) {
    const query = new URLSearchParams({
      startDate: cursor.from,
      endDate: cursor.to,
      page: String(cursor.page),
      pageSize: String(PAGE_SIZE),
    })
    const { body, response } = await request(
      `/orders/v2/ordersBulk?${query.toString()}`,
      tokens,
    )
    if (!Array.isArray(body))
      throw new ToastPayloadError('Toast orders response is invalid.')
    const menuItems = await menu(tokens)
    const records = body.flatMap((value) => {
      if (!value || typeof value !== 'object')
        throw new ToastPayloadError('Toast order is invalid.')
      return orderRecords(value as JsonObject, menuItems)
    })
    return { records, count: body.length, response }
  }

  function initialCursor(mode: Cursor['mode']): Cursor {
    const now = Date.now()
    const from = new Date(
      now -
        (mode === 'backfill' ? backfillDays : incrementalLookbackDays) *
          24 *
          60 *
          60 *
          1000,
    )
    return {
      mode,
      from: from.toISOString(),
      to: new Date(
        mode === 'backfill'
          ? from.getTime() + backfillWindowDays * 24 * 60 * 60 * 1000
          : now,
      ).toISOString(),
      page: 1,
    }
  }

  function nextBackfillCursor(cursor: Cursor): Cursor | null {
    const from = new Date(cursor.from)
    const configuredEnd = new Date(cursor.to)
    if (configuredEnd.getTime() >= Date.now()) return null
    const to = new Date(
      Math.min(
        configuredEnd.getTime() + backfillWindowDays * 24 * 60 * 60 * 1000,
        Date.now(),
      ),
    )
    return {
      mode: 'backfill',
      from: configuredEnd.toISOString(),
      to: to.toISOString(),
      page: 1,
    }
  }

  return {
    provider: TOAST_PROVIDER,

    // Toast's current machine-client authentication is non-interactive. The
    // framework still asks adapters for a handoff URL; this URL carries no
    // secret and lets the UI document the configured restaurant connection.
    authorizationUrl(input) {
      const url = new URL('https://www.toasttab.com')
      url.searchParams.set('state', input.state)
      url.searchParams.set('redirect_uri', input.redirectUri)
      url.searchParams.set('restaurant', options.restaurantExternalId)
      return url.toString()
    },

    async exchangeCode(): Promise<ConnectorAuthorization> {
      return authenticate()
    },

    async refreshTokens(): Promise<ConnectorTokens> {
      const authorization = await authenticate()
      return authorization.tokens
    },

    async backfill({ tokens, cursor }): Promise<ConnectorPage> {
      const parsed = decodeCursor(cursor) ?? initialCursor('backfill')
      if (parsed.mode !== 'backfill')
        throw new ToastPayloadError('The Toast backfill cursor is invalid.')
      const page = await orders(tokens, parsed)
      if (page.count === PAGE_SIZE)
        return {
          records: page.records,
          nextCursor: encodeCursor({ ...parsed, page: parsed.page + 1 }),
          complete: false,
        }
      const next = nextBackfillCursor(parsed)
      return {
        records: page.records,
        nextCursor: next ? encodeCursor(next) : null,
        complete: next === null,
      }
    },

    async incremental({ tokens, cursor }): Promise<ConnectorPage> {
      const parsed = decodeCursor(cursor) ?? initialCursor('incremental')
      if (parsed.mode !== 'incremental')
        throw new ToastPayloadError('The Toast incremental cursor is invalid.')
      const page = await orders(tokens, parsed)
      if (page.count === PAGE_SIZE)
        return {
          records: page.records,
          nextCursor: encodeCursor({ ...parsed, page: parsed.page + 1 }),
          complete: false,
        }
      return { records: page.records, nextCursor: null, complete: true }
    },

    async verifyWebhook(input): Promise<ConnectorWebhook> {
      let body: JsonObject
      try {
        body = parseJson(JSON.parse(input.rawBody))
      } catch {
        throw new ToastPayloadError('The Toast webhook body is invalid.')
      }
      const timestamp = dateValue(body.timestamp, 'webhook timestamp')
      if (
        !verifyToastSignature(
          input.rawBody,
          input.signature,
          requiredString(body.timestamp, 'webhook timestamp'),
          options.webhookSecret,
        )
      )
        throw new Error('The Toast webhook signature is invalid.')
      return {
        eventId: requiredString(body.guid, 'webhook event ID'),
        occurredAt: timestamp,
      }
    },
  }
}

export function toastWebhookSignature(input: {
  rawBody: string
  timestamp: string
  webhookSecret: string
}): string {
  return createHmac('sha256', input.webhookSecret)
    .update(input.rawBody + input.timestamp)
    .digest('base64')
}
