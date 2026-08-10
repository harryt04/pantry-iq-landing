import { createHmac, timingSafeEqual } from 'node:crypto'

import {
  resolveExactItemName,
  type ItemResolutionCandidate,
} from '@/src/server/ingestion/item-resolution'
import {
  normalizePurchaseOrder,
  type NormalizedPurchaseOrder,
} from '@/src/server/ingestion/records'
import {
  ConnectorAuthorizationRevokedError,
  type ConnectorAdapter,
  type ConnectorAuthorization,
  type ConnectorPage,
  type ConnectorTokens,
  type ConnectorWebhook,
} from './types'

export const QUICKBOOKS_PROVIDER = 'quickbooks'
export const QUICKBOOKS_SCOPES = ['com.intuit.quickbooks.accounting'] as const

const DEFAULT_API_BASE_URL = 'https://quickbooks.api.intuit.com'
const DEFAULT_OAUTH_BASE_URL = 'https://oauth.platform.intuit.com'
const DEFAULT_BACKFILL_DAYS = 365
const DEFAULT_INCREMENTAL_LOOKBACK_DAYS = 7
const PAGE_SIZE = 100

type JsonObject = { [key: string]: unknown }
type QuickBooksFetch = typeof fetch

export type QuickBooksTaxMode = 'exclude' | 'include'

export type QuickBooksConnectorOptions = {
  clientId: string
  clientSecret: string
  verifierToken: string
  currencyCode: string
  taxMode: QuickBooksTaxMode
  items: readonly ItemResolutionCandidate[]
  /** The realm ID is returned with the OAuth callback and persisted as the account ID. */
  realmId?: string
  apiBaseUrl?: string
  oauthBaseUrl?: string
  backfillDays?: number
  incrementalLookbackDays?: number
  fetchImpl?: QuickBooksFetch
}

export class QuickBooksPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuickBooksPayloadError'
  }
}

export class QuickBooksItemResolutionError extends Error {
  readonly rawItemName: string

  constructor(rawItemName: string) {
    super(
      `QuickBooks item "${rawItemName}" does not exactly match an active PantryIQ item. Resolve it before syncing.`,
    )
    this.name = 'QuickBooksItemResolutionError'
    this.rawItemName = rawItemName
  }
}

export class QuickBooksCurrencyError extends Error {
  readonly currencyCode: string

  constructor(currencyCode: string) {
    super(
      `QuickBooks bill currency "${currencyCode}" does not match the location currency.`,
    )
    this.name = 'QuickBooksCurrencyError'
    this.currencyCode = currencyCode
  }
}

export class QuickBooksTaxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuickBooksTaxError'
  }
}

type Cursor = {
  from: string
  mode: 'backfill' | 'incremental'
  startPosition: number
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new QuickBooksPayloadError(`QuickBooks ${field} is missing.`)
  return value.trim()
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function dateValue(value: unknown, field: string): Date {
  const date = new Date(requiredString(value, field))
  if (Number.isNaN(date.getTime()))
    throw new QuickBooksPayloadError(`QuickBooks ${field} is not a valid date.`)
  return date
}

/** QuickBooks sends JSON numbers for some monetary fields; stringify at the boundary and do all arithmetic with BigInt. */
function decimalValue(value: unknown, field: string): string {
  const text =
    typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : requiredString(value, field)
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(text))
    throw new QuickBooksPayloadError(
      `QuickBooks ${field} is not a non-negative decimal.`,
    )
  return text
}

function decimalParts(value: string) {
  const [whole = '0', fraction = ''] = value.split('.')
  return { digits: BigInt(`${whole}${fraction}`), scale: fraction.length }
}

function decimalString(digits: bigint, scale: number): string {
  if (digits === 0n) return '0'
  const raw = digits.toString().padStart(scale + 1, '0')
  if (scale === 0) return raw
  const whole = raw.slice(0, -scale)
  const fraction = raw.slice(-scale).replace(/0+$/u, '')
  return fraction ? `${whole}.${fraction}` : whole
}

function divideDecimal(left: string, right: string): string {
  const a = decimalParts(left)
  const b = decimalParts(right)
  if (b.digits === 0n)
    throw new QuickBooksPayloadError('QuickBooks line quantity cannot be zero.')
  const scale = 6
  const exponent = scale + b.scale - a.scale
  let numerator = a.digits
  let denominator = b.digits
  if (exponent >= 0) numerator *= 10n ** BigInt(exponent)
  else denominator *= 10n ** BigInt(-exponent)
  let quotient = numerator / denominator
  if ((numerator % denominator) * 2n >= denominator) quotient += 1n
  return decimalString(quotient, scale)
}

function parseJson(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new QuickBooksPayloadError(
      'QuickBooks returned an invalid JSON object.',
    )
  return value as JsonObject
}

function parseArray(value: unknown, field: string): JsonObject[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      throw new QuickBooksPayloadError(
        `QuickBooks ${field} contains an invalid entry.`,
      )
    return entry as JsonObject
  })
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

function decodeCursor(value: string | null): Cursor | null {
  if (!value) return null
  try {
    const parsed = parseJson(
      JSON.parse(Buffer.from(value, 'base64url').toString('utf8')),
    )
    if (
      (parsed.mode !== 'backfill' && parsed.mode !== 'incremental') ||
      typeof parsed.from !== 'string' ||
      !Number.isInteger(parsed.startPosition) ||
      (parsed.startPosition as number) < 1
    )
      throw new Error('invalid')
    dateValue(parsed.from, 'sync cursor start')
    return {
      mode: parsed.mode,
      from: parsed.from,
      startPosition: parsed.startPosition as number,
    }
  } catch {
    throw new QuickBooksPayloadError('The QuickBooks sync cursor is invalid.')
  }
}

function queryEntities(body: JsonObject, entity: string): JsonObject[] {
  const response = parseJson(body.QueryResponse)
  const value = response[entity]
  if (value === undefined) return []
  return Array.isArray(value) ? parseArray(value, entity) : [parseJson(value)]
}

function responseError(response: Response, body: unknown): Error {
  if (response.status === 401 || response.status === 403)
    return new ConnectorAuthorizationRevokedError(
      'QuickBooks authorization is no longer valid. Reconnect QuickBooks to continue.',
    )
  const parsed = body && typeof body === 'object' ? (body as JsonObject) : {}
  const fault = parsed.Fault
  const errors =
    fault && typeof fault === 'object' && !Array.isArray(fault)
      ? (fault as JsonObject).Error
      : null
  const detail = Array.isArray(errors)
    ? errors
        .map((error) =>
          error && typeof error === 'object' && 'Detail' in error
            ? String((error as JsonObject).Detail)
            : '',
        )
        .filter(Boolean)
        .join('; ')
    : ''
  return new Error(
    `QuickBooks API request failed (${response.status}).${detail ? ` ${detail}` : ''}`,
  )
}

function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  verifierToken: string,
): boolean {
  if (!signature || !verifierToken) return false
  const expected = createHmac('sha256', verifierToken).update(rawBody).digest()
  const supplied = Buffer.from(signature, 'base64')
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  )
}

export function createQuickBooksConnector(
  options: QuickBooksConnectorOptions,
): ConnectorAdapter {
  if (!options.clientId.trim() || !options.clientSecret.trim())
    throw new Error('QuickBooks OAuth client credentials are required.')
  if (!options.verifierToken.trim())
    throw new Error('The QuickBooks webhook verifier token is required.')
  if (!/^[A-Z]{3}$/u.test(options.currencyCode))
    throw new Error(
      'QuickBooks currency code must be a three-letter uppercase code.',
    )
  if (options.taxMode !== 'exclude' && options.taxMode !== 'include')
    throw new Error('QuickBooks tax mode must be exclude or include.')
  if (!options.items.length)
    throw new Error(
      'At least one PantryIQ item is required for QuickBooks resolution.',
    )

  const backfillDays = options.backfillDays ?? DEFAULT_BACKFILL_DAYS
  const incrementalLookbackDays =
    options.incrementalLookbackDays ?? DEFAULT_INCREMENTAL_LOOKBACK_DAYS
  for (const [name, value] of [
    ['backfill days', backfillDays],
    ['incremental lookback days', incrementalLookbackDays],
  ] as const) {
    if (!Number.isInteger(value) || value < 1)
      throw new Error(`QuickBooks ${name} must be a positive integer.`)
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const apiBaseUrl = (
    options.apiBaseUrl ??
    process.env.QUICKBOOKS_API_BASE_URL ??
    DEFAULT_API_BASE_URL
  ).replace(/\/$/u, '')
  const oauthBaseUrl = (
    options.oauthBaseUrl ??
    process.env.QUICKBOOKS_OAUTH_BASE_URL ??
    DEFAULT_OAUTH_BASE_URL
  ).replace(/\/$/u, '')
  let itemNamesPromise: Promise<ReadonlyMap<string, string>> | null = null
  let vendorNamesPromise: Promise<ReadonlyMap<string, string>> | null = null

  function realmIdForApi(): string {
    const realmId = optionalString(options.realmId)
    if (!realmId)
      throw new QuickBooksPayloadError(
        'QuickBooks realm ID is required before syncing this connection.',
      )
    return realmId
  }

  async function jsonResponse(response: Response): Promise<JsonObject> {
    let body: unknown
    try {
      body = await response.json()
    } catch {
      body = {}
    }
    const parsed = body && typeof body === 'object' ? (body as JsonObject) : {}
    if (!response.ok) throw responseError(response, parsed)
    return parsed
  }

  async function apiRequest(
    path: string,
    tokens: ConnectorTokens,
  ): Promise<JsonObject> {
    const response = await fetchImpl(
      `${apiBaseUrl}/v3/company/${encodeURIComponent(realmIdForApi())}${path}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      },
    )
    return jsonResponse(response)
  }

  async function tokenRequest(body: URLSearchParams): Promise<JsonObject> {
    const response = await fetchImpl(
      `${oauthBaseUrl}/oauth2/v1/tokens/bearer`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${Buffer.from(`${options.clientId}:${options.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    )
    return jsonResponse(response)
  }

  async function loadReferenceNames(
    entity: 'Item' | 'Vendor',
    tokens: ConnectorTokens,
  ): Promise<ReadonlyMap<string, string>> {
    const names = new Map<string, string>()
    for (let startPosition = 1; ; startPosition += PAGE_SIZE) {
      const query = encodeURIComponent(
        `SELECT * FROM ${entity} STARTPOSITION ${startPosition} MAXRESULTS ${PAGE_SIZE}`,
      )
      const body = await apiRequest(`/query?query=${query}`, tokens)
      const records = queryEntities(body, entity)
      for (const record of records) {
        const id = optionalString(record.Id)
        const name = optionalString(record.Name ?? record.DisplayName)
        if (id && name) names.set(id, name)
      }
      if (records.length < PAGE_SIZE) return names
    }
  }

  async function itemNames(tokens: ConnectorTokens) {
    itemNamesPromise ??= loadReferenceNames('Item', tokens)
    return itemNamesPromise
  }

  async function vendorNames(tokens: ConnectorTokens) {
    vendorNamesPromise ??= loadReferenceNames('Vendor', tokens)
    return vendorNamesPromise
  }

  async function resolveItemName(
    rawItemName: string | null,
    itemId: string | null,
    tokens: ConnectorTokens,
  ): Promise<{ id: string; rawName: string }> {
    const sourceName =
      rawItemName ??
      (itemId ? ((await itemNames(tokens)).get(itemId) ?? null) : null)
    if (!sourceName)
      throw new QuickBooksPayloadError('QuickBooks bill line has no item name.')
    const resolution = resolveExactItemName(sourceName, options.items)
    if (resolution.status !== 'matched')
      throw new QuickBooksItemResolutionError(sourceName)
    return { id: resolution.item.id, rawName: sourceName }
  }

  async function billRecord(
    bill: JsonObject,
    tokens: ConnectorTokens,
  ): Promise<NormalizedPurchaseOrder> {
    const externalId = requiredString(bill.Id, 'bill ID')
    const currencyRef = parseJson(bill.CurrencyRef)
    const currencyCode = requiredString(currencyRef.value, 'bill currency')
    if (currencyCode !== options.currencyCode)
      throw new QuickBooksCurrencyError(currencyCode)

    const taxCalculation =
      optionalString(bill.GlobalTaxCalculation) ?? 'NotApplicable'
    if (options.taxMode === 'exclude' && taxCalculation === 'TaxInclusive')
      throw new QuickBooksTaxError(
        'QuickBooks returned a tax-inclusive bill while this connection excludes tax.',
      )
    if (options.taxMode === 'include' && taxCalculation !== 'TaxInclusive')
      throw new QuickBooksTaxError(
        'QuickBooks returned a tax-exclusive bill while this connection includes tax.',
      )

    const vendorRef = bill.VendorRef ? parseJson(bill.VendorRef) : null
    const vendorId = vendorRef ? optionalString(vendorRef.value) : null
    const supplierName = vendorRef
      ? (optionalString(vendorRef.name) ??
        (vendorId ? ((await vendorNames(tokens)).get(vendorId) ?? null) : null))
      : null
    const lines = parseArray(bill.Line, 'bill lines')
      .filter((line) => line.DetailType === 'ItemBasedExpenseLineDetail')
      .map(async (line) => {
        const detail = parseJson(line.ItemBasedExpenseLineDetail)
        const itemRef = parseJson(detail.ItemRef)
        const item = await resolveItemName(
          optionalString(itemRef.name),
          optionalString(itemRef.value),
          tokens,
        )
        const qty = decimalValue(detail.Qty, 'bill line quantity')
        const amount = decimalValue(
          options.taxMode === 'include'
            ? (detail.TaxInclusiveAmt ?? line.Amount)
            : line.Amount,
          'bill line amount',
        )
        const configuredUnitPrice = optionalString(detail.UnitPrice)
        const unitCost =
          options.taxMode === 'exclude' && configuredUnitPrice
            ? decimalValue(configuredUnitPrice, 'bill line unit price')
            : divideDecimal(amount, qty)
        return {
          itemId: item.id,
          rawItemName: item.rawName,
          qty,
          unitCost,
          totalCost: amount,
        }
      })
    const resolvedLines = await Promise.all(lines)
    if (!resolvedLines.length)
      throw new QuickBooksPayloadError(
        'QuickBooks bill contains no item-based expense lines.',
      )

    return normalizePurchaseOrder({
      source: QUICKBOOKS_PROVIDER,
      externalId,
      orderedAt: dateValue(bill.TxnDate, 'bill date'),
      receivedAt: null,
      supplierName,
      lines: resolvedLines,
    })
  }

  async function bills(tokens: ConnectorTokens, cursor: Cursor) {
    const where =
      cursor.mode === 'backfill'
        ? `TxnDate >= '${cursor.from.slice(0, 10)}'`
        : `MetaData.LastUpdatedTime > '${cursor.from}'`
    const statement = `SELECT * FROM Bill WHERE ${where} ORDERBY MetaData.LastUpdatedTime ASC STARTPOSITION ${cursor.startPosition} MAXRESULTS ${PAGE_SIZE}`
    const body = await apiRequest(
      `/query?query=${encodeURIComponent(statement)}`,
      tokens,
    )
    const billValues = queryEntities(body, 'Bill')
    const records: NormalizedPurchaseOrder[] = []
    for (const bill of billValues) records.push(await billRecord(bill, tokens))
    return { records, count: billValues.length }
  }

  function initialCursor(mode: Cursor['mode']): Cursor {
    const days = mode === 'backfill' ? backfillDays : incrementalLookbackDays
    return {
      mode,
      from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
      startPosition: 1,
    }
  }

  return {
    provider: QUICKBOOKS_PROVIDER,

    authorizationUrl(input) {
      const url = new URL('/connect/oauth2', 'https://appcenter.intuit.com')
      url.searchParams.set('client_id', options.clientId)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('scope', QUICKBOOKS_SCOPES.join(' '))
      url.searchParams.set('redirect_uri', input.redirectUri)
      url.searchParams.set('state', input.state)
      return url.toString()
    },

    async exchangeCode(input): Promise<ConnectorAuthorization> {
      const body = await tokenRequest(
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: input.code,
          redirect_uri: input.redirectUri,
        }),
      )
      const accessToken = requiredString(body.access_token, 'access token')
      const refreshToken = requiredString(body.refresh_token, 'refresh token')
      const expiresIn = body.expires_in
      if (
        typeof expiresIn !== 'number' ||
        !Number.isInteger(expiresIn) ||
        expiresIn < 1
      )
        throw new QuickBooksPayloadError(
          'QuickBooks token expiration is missing.',
        )
      const providerAccountId =
        optionalString(input.providerAccountId) ??
        optionalString(options.realmId)
      if (!providerAccountId)
        throw new QuickBooksPayloadError(
          'QuickBooks realm ID is required from the OAuth callback.',
        )
      return {
        providerAccountId,
        tokens: {
          accessToken,
          refreshToken,
          accessTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
          ...(optionalString(body.scope)
            ? { scope: optionalString(body.scope)! }
            : {}),
        },
      }
    },

    async refreshTokens(tokens): Promise<ConnectorTokens> {
      const refreshToken = tokens.refreshToken
      if (!refreshToken)
        throw new ConnectorAuthorizationRevokedError(
          'QuickBooks did not return a refresh token.',
        )
      const body = await tokenRequest(
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      )
      const expiresIn = body.expires_in
      if (
        typeof expiresIn !== 'number' ||
        !Number.isInteger(expiresIn) ||
        expiresIn < 1
      )
        throw new QuickBooksPayloadError(
          'QuickBooks refreshed token expiration is missing.',
        )
      return {
        accessToken: requiredString(body.access_token, 'access token'),
        refreshToken: optionalString(body.refresh_token) ?? refreshToken,
        accessTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        ...((optionalString(body.scope) ?? tokens.scope)
          ? { scope: optionalString(body.scope) ?? tokens.scope }
          : {}),
      }
    },

    async backfill({ tokens, cursor }): Promise<ConnectorPage> {
      const parsed = decodeCursor(cursor) ?? initialCursor('backfill')
      if (parsed.mode !== 'backfill')
        throw new QuickBooksPayloadError(
          'The QuickBooks backfill cursor is invalid.',
        )
      const page = await bills(tokens, parsed)
      const complete = page.count < PAGE_SIZE
      return {
        records: page.records,
        nextCursor: complete
          ? null
          : encodeCursor({
              ...parsed,
              startPosition: parsed.startPosition + page.count,
            }),
        complete,
      }
    },

    async incremental({ tokens, cursor }): Promise<ConnectorPage> {
      const parsed = decodeCursor(cursor) ?? initialCursor('incremental')
      if (parsed.mode !== 'incremental')
        throw new QuickBooksPayloadError(
          'The QuickBooks incremental cursor is invalid.',
        )
      const page = await bills(tokens, parsed)
      const complete = page.count < PAGE_SIZE
      return {
        records: page.records,
        nextCursor: complete
          ? null
          : encodeCursor({
              ...parsed,
              startPosition: parsed.startPosition + page.count,
            }),
        complete,
      }
    },

    async verifyWebhook(input): Promise<ConnectorWebhook> {
      if (
        !verifyWebhookSignature(
          input.rawBody,
          input.signature,
          options.verifierToken,
        )
      )
        throw new Error('The QuickBooks webhook signature is invalid.')
      let body: JsonObject
      try {
        body = parseJson(JSON.parse(input.rawBody))
      } catch {
        throw new QuickBooksPayloadError(
          'The QuickBooks webhook body is invalid.',
        )
      }
      const notifications = parseArray(
        body.eventNotifications,
        'event notifications',
      )
      const first = notifications[0]
      const realmId = first ? optionalString(first.realmId) : null
      const changeEvent = first?.dataChangeEvent
      const entities =
        changeEvent &&
        typeof changeEvent === 'object' &&
        !Array.isArray(changeEvent)
          ? parseArray((changeEvent as JsonObject).entities, 'webhook entities')
          : []
      const entity = entities[0]
      const name = entity
        ? requiredString(entity.name, 'webhook entity name')
        : null
      const id = entity ? requiredString(entity.id, 'webhook entity ID') : null
      const operation = entity
        ? requiredString(entity.operation, 'webhook operation')
        : null
      const changedAt = entity ? optionalString(entity.lastUpdated) : null
      if (!realmId || !name || !id || !operation)
        throw new QuickBooksPayloadError(
          'The QuickBooks webhook has no bill change event.',
        )
      return {
        eventId: `${realmId}:${name}:${id}:${operation}:${changedAt ?? input.receivedAt.toISOString()}`,
        occurredAt: changedAt
          ? dateValue(changedAt, 'webhook timestamp')
          : input.receivedAt,
      }
    },
  }
}

export function quickBooksWebhookSignature(input: {
  rawBody: string
  verifierToken: string
}): string {
  return createHmac('sha256', input.verifierToken)
    .update(input.rawBody)
    .digest('base64')
}
