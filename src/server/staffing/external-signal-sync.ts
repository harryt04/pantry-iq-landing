import { db } from '@/src/server/db/client'
import { externalSignalFetches, externalSignals } from '@/src/server/db/schema'

import type { ExternalSignalInput } from './external-signals'

export type ExternalSignalProvider = {
  source: string
  fetch: (input: {
    locationId: string
    from: Date
    to: Date
    now: Date
  }) => Promise<{
    signals: readonly ExternalSignalInput[]
    costMicros: string
    currency: string
  }>
}

export type ExternalSignalSyncResult = {
  fetchId: string
  source: string
  rowCount: number
  costMicros: string
  currency: string
}

/**
 * Provider adapters return normalized signal features. This boundary owns the
 * durable fetch ledger, provenance, and replacement of a provider's rows.
 * A provider failure is recorded and rethrown so scheduling can retry it.
 */
export async function syncExternalSignals(input: {
  locationId: string
  provider: ExternalSignalProvider
  from: Date
  to: Date
  now?: Date
}): Promise<ExternalSignalSyncResult> {
  const now = input.now ?? new Date()
  const fetchId = crypto.randomUUID()
  let response: Awaited<ReturnType<ExternalSignalProvider['fetch']>>

  try {
    response = await input.provider.fetch({
      locationId: input.locationId,
      from: input.from,
      to: input.to,
      now,
    })
  } catch (error) {
    await db.insert(externalSignalFetches).values({
      id: fetchId,
      locationId: input.locationId,
      source: input.provider.source,
      requestedAt: now,
      completedAt: now,
      status: 'failed',
      error: error instanceof Error ? error.message : 'provider request failed',
    })
    throw error
  }

  await db.transaction(async (tx) => {
    await tx.insert(externalSignalFetches).values({
      id: fetchId,
      locationId: input.locationId,
      source: input.provider.source,
      requestedAt: now,
      completedAt: now,
      status: 'succeeded',
      rowCount: response.signals.length,
      costMicros: response.costMicros,
      currency: response.currency,
    })

    if (response.signals.length === 0) return

    for (const signal of response.signals) {
      await tx
        .insert(externalSignals)
        .values({
          id: signal.id,
          locationId: input.locationId,
          fetchId,
          kind: signal.kind,
          businessDate: signal.businessDate,
          validFrom: signal.validFrom,
          validTo: signal.validTo,
          status: signal.status,
          source: signal.source,
          externalId: signal.externalId,
          feature: signal.feature,
          condition: signal.condition,
          value: signal.value,
          rawData: signal.rawData ?? {
            kind: signal.kind,
            feature: signal.feature,
            condition: signal.condition,
            value: signal.value,
          },
          sourceUrl: signal.sourceUrl ?? null,
          retrievedAt: signal.retrievedAt,
        })
        .onConflictDoUpdate({
          target: [
            externalSignals.locationId,
            externalSignals.source,
            externalSignals.externalId,
            externalSignals.feature,
          ],
          set: {
            fetchId,
            kind: signal.kind,
            businessDate: signal.businessDate,
            validFrom: signal.validFrom,
            validTo: signal.validTo,
            status: signal.status,
            condition: signal.condition,
            value: signal.value,
            rawData: signal.rawData ?? {},
            sourceUrl: signal.sourceUrl ?? null,
            retrievedAt: signal.retrievedAt,
          },
        })
    }
  })

  return {
    fetchId,
    source: input.provider.source,
    rowCount: response.signals.length,
    costMicros: response.costMicros,
    currency: response.currency,
  }
}
