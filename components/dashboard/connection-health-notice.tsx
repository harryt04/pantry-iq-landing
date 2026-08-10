import * as React from 'react'
import Link from 'next/link'

import {
  classifyConnectorHealth,
  elapsedLabel,
  providerLabel,
  type ConnectorStatusRecord,
} from '@/src/server/connectors/health'

function issueTitle(
  health: ReturnType<typeof classifyConnectorHealth>['health'],
) {
  if (health === 'revoked') return 'Reconnect required'
  if (health === 'failed') return 'Sync failed'
  return 'Data is stale'
}

function issueCopy(
  connection: ReturnType<typeof classifyConnectorHealth>,
): string {
  const provider = providerLabel(connection.provider)
  if (connection.health === 'revoked')
    return `${provider} is no longer authorized. The dashboard is still using the last successful data from this connection.`
  if (connection.health === 'failed')
    return `${provider} could not finish its last sync. The dashboard is still using the last successful data from this connection.`
  return connection.lastSyncedAt
    ? `${provider} last synced ${elapsedLabel(connection.staleForMs)}. Figures from this connection may be out of date.`
    : `${provider} has not completed a sync yet. Figures from this connection are not current.`
}

export function ConnectionHealthNotice({
  connections,
  locationId,
}: {
  connections: readonly ConnectorStatusRecord[]
  locationId: string
}) {
  const issues = connections
    .map((connection) => classifyConnectorHealth(connection))
    .filter((connection) => connection.health !== 'healthy')

  if (issues.length === 0) return null

  return (
    <section
      aria-labelledby="connection-health-title"
      className="connection-health-notice"
      role="alert"
    >
      <div className="connection-health-notice__icon" aria-hidden="true">
        !
      </div>
      <div>
        <p className="app-page__eyebrow">Data connection</p>
        <h2 id="connection-health-title">
          Some imported numbers may be out of date.
        </h2>
        <ul className="connection-health-notice__list">
          {issues.map((connection) => {
            const provider = providerLabel(connection.provider)
            return (
              <li key={connection.connectionId}>
                <strong>
                  {provider}: {issueTitle(connection.health)}
                </strong>
                <p>{issueCopy(connection)}</p>
                <Link
                  href={`/import?locationId=${encodeURIComponent(locationId)}`}
                >
                  Review {provider} connection
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
