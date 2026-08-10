import type { NormalizedIngestionRecord } from '@/src/server/ingestion/records'

export type ConnectorTokens = {
  accessToken: string
  refreshToken?: string
  accessTokenExpiresAt?: Date
  refreshTokenExpiresAt?: Date
  scope?: string
}

export type ConnectorPage = {
  records: readonly NormalizedIngestionRecord[]
  nextCursor: string | null
  complete: boolean
}

export type ConnectorAuthorization = {
  providerAccountId?: string
  tokens: ConnectorTokens
}

export type ConnectorWebhook = {
  eventId: string
  occurredAt: Date
}

export class ConnectorAuthorizationRevokedError extends Error {
  constructor(message = 'The connector authorization was revoked.') {
    super(message)
    this.name = 'ConnectorAuthorizationRevokedError'
  }
}

export interface ConnectorAdapter {
  readonly provider: string
  authorizationUrl(input: { state: string; redirectUri: string }): string
  exchangeCode(input: {
    code: string
    redirectUri: string
    /** Provider callbacks such as QuickBooks return the account ID beside the code. */
    providerAccountId?: string
  }): Promise<ConnectorAuthorization>
  refreshTokens(tokens: ConnectorTokens): Promise<ConnectorTokens>
  backfill(input: {
    tokens: ConnectorTokens
    cursor: string | null
  }): Promise<ConnectorPage>
  incremental(input: {
    tokens: ConnectorTokens
    cursor: string | null
  }): Promise<ConnectorPage>
  verifyWebhook(input: {
    rawBody: string
    signature: string | null
    receivedAt: Date
  }): Promise<ConnectorWebhook>
}
