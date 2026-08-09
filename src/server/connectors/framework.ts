import { createHash, randomBytes } from 'node:crypto'

import { and, eq, gt, isNull } from 'drizzle-orm'

import { db } from '@/src/server/db/client'
import {
  connectorConnections,
  connectorOAuthStates,
  connectorWebhookDeliveries,
  locations,
} from '@/src/server/db/schema'
import {
  requireSession,
  requireOwnedLocation,
} from '@/src/server/auth/authorization'
import {
  createIngestionHistory,
  persistNormalizedRecords,
} from '@/src/server/ingestion/persistence'

import {
  decryptConnectorTokens,
  encryptConnectorTokens,
  hashOAuthState,
} from './credentials'
import { withConnectorRetry } from './retry'
import {
  ConnectorAuthorizationRevokedError,
  type ConnectorAdapter,
  type ConnectorTokens,
} from './types'

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000
const WEBHOOK_CLOCK_SKEW_MS = 5 * 60 * 1000
const ACCESS_TOKEN_REFRESH_WINDOW_MS = 60 * 1000

export class ConnectorStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConnectorStateError'
  }
}

export class ConnectorReplayError extends Error {
  constructor(message = 'The connector webhook was already received.') {
    super(message)
    this.name = 'ConnectorReplayError'
  }
}

function assertProvider(adapter: ConnectorAdapter, provider: string) {
  if (!adapter.provider || adapter.provider !== provider)
    throw new ConnectorStateError('The connector provider does not match.')
}

function safeReturnTo(returnTo: string | undefined): string | null {
  if (!returnTo) return null
  if (!returnTo.startsWith('/') || returnTo.startsWith('//'))
    throw new ConnectorStateError('The connector return path is invalid.')
  return returnTo
}

export async function beginConnectorAuthorization(input: {
  headers: Headers
  locationId: string
  adapter: ConnectorAdapter
  redirectUri: string
  returnTo?: string
  now?: Date
}): Promise<{ url: string; state: string }> {
  await requireOwnedLocation(input.headers, input.locationId)
  const now = input.now ?? new Date()
  const state = randomBytes(32).toString('base64url')

  await db.insert(connectorOAuthStates).values({
    locationId: input.locationId,
    provider: input.adapter.provider,
    stateHash: hashOAuthState(state),
    redirectUri: input.redirectUri,
    returnTo: safeReturnTo(input.returnTo),
    expiresAt: new Date(now.getTime() + OAUTH_STATE_TTL_MS),
  })

  return {
    state,
    url: input.adapter.authorizationUrl({
      state,
      redirectUri: input.redirectUri,
    }),
  }
}

export async function completeConnectorAuthorization(input: {
  adapter: ConnectorAdapter
  code: string
  state: string
  now?: Date
}): Promise<{
  connectionId: string
  locationId: string
  returnTo: string | null
}> {
  const now = input.now ?? new Date()
  const [claimedState] = await db
    .update(connectorOAuthStates)
    .set({ consumedAt: now })
    .where(
      and(
        eq(connectorOAuthStates.stateHash, hashOAuthState(input.state)),
        eq(connectorOAuthStates.provider, input.adapter.provider),
        isNull(connectorOAuthStates.consumedAt),
        gt(connectorOAuthStates.expiresAt, now),
      ),
    )
    .returning({
      locationId: connectorOAuthStates.locationId,
      redirectUri: connectorOAuthStates.redirectUri,
      returnTo: connectorOAuthStates.returnTo,
    })

  if (!claimedState)
    throw new ConnectorStateError(
      'The connector authorization state is invalid or expired.',
    )

  const authorization = await input.adapter.exchangeCode({
    code: input.code,
    redirectUri: claimedState.redirectUri,
  })
  const encryptedCredentials = encryptConnectorTokens(authorization.tokens)

  const [connection] = await db
    .insert(connectorConnections)
    .values({
      locationId: claimedState.locationId,
      provider: input.adapter.provider,
      externalAccountId: authorization.providerAccountId,
      status: 'connected',
      encryptedCredentials,
      accessTokenExpiresAt: authorization.tokens.accessTokenExpiresAt,
      connectedAt: now,
    })
    .onConflictDoUpdate({
      target: [connectorConnections.locationId, connectorConnections.provider],
      set: {
        externalAccountId: authorization.providerAccountId,
        status: 'connected',
        encryptedCredentials,
        accessTokenExpiresAt: authorization.tokens.accessTokenExpiresAt,
        syncCursor: null,
        backfillCursor: null,
        lastSyncedAt: null,
        lastError: null,
        connectedAt: now,
        updatedAt: now,
      },
    })
    .returning({ id: connectorConnections.id })

  if (!connection)
    throw new ConnectorStateError(
      'The connector connection could not be saved.',
    )
  return {
    connectionId: connection.id,
    locationId: claimedState.locationId,
    returnTo: claimedState.returnTo,
  }
}

async function getOwnedConnection(userId: string, connectionId: string) {
  const [connection] = await db
    .select({
      id: connectorConnections.id,
      locationId: connectorConnections.locationId,
      provider: connectorConnections.provider,
      status: connectorConnections.status,
      encryptedCredentials: connectorConnections.encryptedCredentials,
      accessTokenExpiresAt: connectorConnections.accessTokenExpiresAt,
      syncCursor: connectorConnections.syncCursor,
      backfillCursor: connectorConnections.backfillCursor,
    })
    .from(connectorConnections)
    .innerJoin(locations, eq(locations.id, connectorConnections.locationId))
    .where(
      and(
        eq(connectorConnections.id, connectionId),
        eq(locations.userId, userId),
      ),
    )
    .limit(1)

  if (!connection)
    throw new ConnectorStateError('The connector connection is not available.')
  return connection
}

/**
 * Disconnecting is deliberately a durable state transition. Imported rows
 * remain available for audit, while the bearer credential is replaced by a
 * non-secret sentinel so a later sync cannot resume accidentally.
 */
export async function disconnectConnectorConnection(input: {
  headers: Headers
  connectionId: string
  now?: Date
}) {
  const session = await requireSession(input.headers)
  const connection = await getOwnedConnection(
    session.user.id,
    input.connectionId,
  )
  const now = input.now ?? new Date()

  await db
    .update(connectorConnections)
    .set({
      status: 'disconnected',
      encryptedCredentials: 'disconnected',
      lastError: null,
      updatedAt: now,
    })
    .where(eq(connectorConnections.id, connection.id))

  return { connectionId: connection.id, locationId: connection.locationId }
}

async function refreshIfNeeded(
  connection: Awaited<ReturnType<typeof getOwnedConnection>>,
  adapter: ConnectorAdapter,
  now: Date,
): Promise<ConnectorTokens> {
  let tokens = decryptConnectorTokens(connection.encryptedCredentials)
  const expiresAt =
    connection.accessTokenExpiresAt?.getTime() ??
    tokens.accessTokenExpiresAt?.getTime()
  if (
    expiresAt === undefined ||
    expiresAt - now.getTime() > ACCESS_TOKEN_REFRESH_WINDOW_MS
  )
    return tokens

  tokens = await withConnectorRetry(() => adapter.refreshTokens(tokens))
  await db
    .update(connectorConnections)
    .set({
      encryptedCredentials: encryptConnectorTokens(tokens),
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      status: 'connected',
      lastError: null,
      updatedAt: now,
    })
    .where(eq(connectorConnections.id, connection.id))
  return tokens
}

export async function syncConnectorConnection(input: {
  userId: string
  connectionId: string
  adapter: ConnectorAdapter
  mode: 'backfill' | 'incremental'
  now?: Date
}): Promise<{ rowsImported: number; pages: number; complete: boolean }> {
  const now = input.now ?? new Date()
  const connection = await getOwnedConnection(input.userId, input.connectionId)
  assertProvider(input.adapter, connection.provider)
  if (connection.status === 'revoked' || connection.status === 'disconnected')
    throw new ConnectorStateError(
      'The connector must be reconnected before syncing.',
    )

  await db
    .update(connectorConnections)
    .set({ status: 'syncing', lastError: null, updatedAt: now })
    .where(eq(connectorConnections.id, connection.id))

  try {
    const tokens = await refreshIfNeeded(connection, input.adapter, now)
    let cursor =
      input.mode === 'backfill'
        ? connection.backfillCursor
        : connection.syncCursor
    let pages = 0
    let rowsImported = 0

    while (true) {
      const page = await withConnectorRetry(() =>
        input.mode === 'backfill'
          ? input.adapter.backfill({ tokens, cursor })
          : input.adapter.incremental({ tokens, cursor }),
      )
      pages += 1
      if (page.nextCursor === cursor && !page.complete)
        throw new ConnectorStateError(
          'The connector returned a non-advancing sync cursor.',
        )

      await db.transaction(async (tx) => {
        const persisted = await persistNormalizedRecords(
          tx,
          connection.locationId,
          page.records,
        )
        rowsImported += persisted.rowsImported
        await createIngestionHistory(tx, {
          locationId: connection.locationId,
          filename: `${connection.provider}-${input.mode}`,
          source: connection.provider,
          rowsImported: persisted.rowsImported,
          mappingUsed: { source: connection.provider, mode: input.mode },
        })
        await tx
          .update(connectorConnections)
          .set({
            ...(input.mode === 'backfill'
              ? { backfillCursor: page.nextCursor }
              : { syncCursor: page.nextCursor }),
            lastSyncedAt: now,
            updatedAt: now,
          })
          .where(eq(connectorConnections.id, connection.id))
      })

      cursor = page.nextCursor
      if (page.complete || cursor === null) {
        await db
          .update(connectorConnections)
          .set({
            status: 'connected',
            lastError: null,
            lastSyncedAt: now,
            updatedAt: now,
          })
          .where(eq(connectorConnections.id, connection.id))
        return { rowsImported, pages, complete: true }
      }
    }
  } catch (error) {
    const revoked = error instanceof ConnectorAuthorizationRevokedError
    await db
      .update(connectorConnections)
      .set({
        status: revoked ? 'revoked' : 'failed',
        lastError: revoked ? 'authorization-revoked' : 'sync-failed',
        updatedAt: now,
      })
      .where(eq(connectorConnections.id, connection.id))
    throw error
  }
}

export async function acceptConnectorWebhook(input: {
  connectionId: string
  adapter: ConnectorAdapter
  rawBody: string
  signature: string | null
  receivedAt?: Date
}): Promise<{ deliveryId: string; eventId: string }> {
  const [connection] = await db
    .select({
      id: connectorConnections.id,
      provider: connectorConnections.provider,
    })
    .from(connectorConnections)
    .where(eq(connectorConnections.id, input.connectionId))
    .limit(1)
  if (!connection)
    throw new ConnectorStateError('The connector connection is not available.')
  assertProvider(input.adapter, connection.provider)

  const receivedAt = input.receivedAt ?? new Date()
  const webhook = await input.adapter.verifyWebhook({
    rawBody: input.rawBody,
    signature: input.signature,
    receivedAt,
  })
  if (!webhook.eventId || Number.isNaN(webhook.occurredAt.getTime()))
    throw new ConnectorReplayError('The connector webhook identity is invalid.')
  if (
    Math.abs(receivedAt.getTime() - webhook.occurredAt.getTime()) >
    WEBHOOK_CLOCK_SKEW_MS
  )
    throw new ConnectorReplayError(
      'The connector webhook timestamp is outside the replay window.',
    )

  const payloadHash = createHash('sha256').update(input.rawBody).digest('hex')
  const [delivery] = await db
    .insert(connectorWebhookDeliveries)
    .values({
      connectionId: input.connectionId,
      providerEventId: webhook.eventId,
      payloadHash,
      receivedAt,
    })
    .onConflictDoNothing()
    .returning({ id: connectorWebhookDeliveries.id })
  if (!delivery) throw new ConnectorReplayError()
  return { deliveryId: delivery.id, eventId: webhook.eventId }
}

export async function markConnectorWebhookProcessed(input: {
  connectionId: string
  eventId: string
  processedAt?: Date
}) {
  await db
    .update(connectorWebhookDeliveries)
    .set({ processedAt: input.processedAt ?? new Date() })
    .where(
      and(
        eq(connectorWebhookDeliveries.connectionId, input.connectionId),
        eq(connectorWebhookDeliveries.providerEventId, input.eventId),
      ),
    )
}
