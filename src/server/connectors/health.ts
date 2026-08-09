export const CONNECTOR_STALE_AFTER_MS = 24 * 60 * 60 * 1_000

export type ConnectorHealth = 'healthy' | 'stale' | 'failed' | 'revoked'

export type ConnectorStatusRecord = {
  connectionId: string
  locationId: string
  provider: string
  status: string
  lastSyncedAt: Date | null
  lastError: string | null
}

export type ConnectorHealthRecord = ConnectorStatusRecord & {
  health: ConnectorHealth
  staleForMs: number | null
}

export function classifyConnectorHealth(
  connection: ConnectorStatusRecord,
  now = new Date(),
): ConnectorHealthRecord {
  if (connection.status === 'revoked' || connection.status === 'disconnected')
    return { ...connection, health: 'revoked', staleForMs: null }

  if (connection.status === 'failed')
    return {
      ...connection,
      health: 'failed',
      staleForMs: staleDuration(connection.lastSyncedAt, now),
    }

  const staleForMs = staleDuration(connection.lastSyncedAt, now)
  if (staleForMs === null || staleForMs >= CONNECTOR_STALE_AFTER_MS)
    return { ...connection, health: 'stale', staleForMs }

  return { ...connection, health: 'healthy', staleForMs }
}

function staleDuration(lastSyncedAt: Date | null, now: Date) {
  if (!lastSyncedAt) return null
  return Math.max(0, now.getTime() - lastSyncedAt.getTime())
}

export function providerLabel(provider: string) {
  if (provider === 'quickbooks') return 'QuickBooks'
  if (provider === 'square') return 'Square'
  if (provider === 'toast') return 'Toast'
  return provider
}

export function elapsedLabel(staleForMs: number | null) {
  if (staleForMs === null) return 'No successful sync yet'
  const hours = Math.max(1, Math.floor(staleForMs / (60 * 60 * 1_000)))
  if (hours < 48) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return `${days} days ago`
}
