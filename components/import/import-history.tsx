'use client'

import * as React from 'react'

type HistoryItem = {
  id: string
  canonicalName: string
  displayName: string
}

type ItemResolutionAudit = {
  created: HistoryItem[]
  matched: HistoryItem[]
}

export type HistoryEntry = {
  id: string
  filename: string
  importType: string
  rowsImported: number
  status: string
  uploadedAt: string
  mappingUsed: Record<string, string | null>
  itemResolution: ItemResolutionAudit | null
}

const labels: Record<string, string> = {
  transactions: 'Transactions',
  purchase_orders: 'Purchase orders',
  inventory: 'Inventory snapshots',
  manual: 'Manual entry',
}

const entryTypeLabels: Record<string, string> = {
  transaction: 'Transaction',
  purchase_order: 'Purchase order',
  inventory: 'Inventory count',
}

const fieldLabels: Record<string, string> = {
  transactedAt: 'Transaction date and time',
  externalId: 'External ID',
  rawItemName: 'Item name',
  category: 'Category',
  qty: 'Quantity',
  unitPrice: 'Unit price',
  totalRevenue: 'Total revenue',
  totalCost: 'Total cost',
  grossMargin: 'Gross margin',
  orderedAt: 'Order date',
  receivedAt: 'Received date',
  supplierName: 'Supplier name',
  unitCost: 'Unit cost',
  countedAt: 'Count date',
  unit: 'Unit of measure',
  shelfLifeDays: 'Shelf life in days',
}

function auditFor(entry: HistoryEntry): ItemResolutionAudit {
  const audit = entry.itemResolution
  return {
    created: Array.isArray(audit?.created) ? audit.created : [],
    matched: Array.isArray(audit?.matched) ? audit.matched : [],
  }
}

export function typeLabel(entry: HistoryEntry) {
  if (entry.importType !== 'manual')
    return labels[entry.importType] ?? entry.importType
  const entryType = entry.mappingUsed?.entryType
  return entryTypeLabels[entryType ?? ''] ?? labels.manual
}

function statusLabel(status: string) {
  return status === 'imported' ? 'Imported' : 'Upload in progress'
}

function ItemList({
  items,
  emptyCopy,
}: {
  items: HistoryItem[]
  emptyCopy: string
}) {
  if (items.length === 0) return <p className="app-page__help">{emptyCopy}</p>
  return (
    <ul className="csv-import-history__items">
      {items.map((item) => (
        <li key={item.id}>
          <strong>{item.displayName}</strong>
          <span>Canonical name: {item.canonicalName}</span>
        </li>
      ))}
    </ul>
  )
}

export function HistoryDetails({ entry }: { entry: HistoryEntry }) {
  const audit = auditFor(entry)
  const mappingEntries = Object.entries(entry.mappingUsed ?? {})
    .filter(
      ([sourceColumn]) =>
        sourceColumn !== 'source' && sourceColumn !== 'entryType',
    )
    .sort(([left], [right]) => left.localeCompare(right))

  return (
    <div className="csv-import-history__details">
      <div className="csv-import-history__detail-grid">
        <div>
          <p className="csv-import-history__label">Record</p>
          <p>
            {statusLabel(entry.status)} · {entry.rowsImported.toLocaleString()}{' '}
            rows
          </p>
        </div>
        <div>
          <p className="csv-import-history__label">Source</p>
          <p>
            {entry.importType === 'manual'
              ? 'Entered in PantryIQ'
              : 'CSV upload'}
          </p>
        </div>
      </div>

      <section aria-labelledby={`mapping-${entry.id}`}>
        <h3 id={`mapping-${entry.id}`}>Column mapping used</h3>
        {mappingEntries.length ? (
          <div className="csv-preview__table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">File column</th>
                  <th scope="col">PantryIQ field</th>
                </tr>
              </thead>
              <tbody>
                {mappingEntries.map(([sourceColumn, field]) => (
                  <tr key={sourceColumn}>
                    <td>{sourceColumn}</td>
                    <td>{field ? (fieldLabels[field] ?? field) : 'Skipped'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="app-page__help">
            No file mapping was used for this entry.
          </p>
        )}
      </section>

      <div className="csv-import-history__item-grid">
        <section aria-labelledby={`created-${entry.id}`}>
          <h3 id={`created-${entry.id}`}>Items created</h3>
          <ItemList
            items={audit.created}
            emptyCopy="No new items were created."
          />
        </section>
        <section aria-labelledby={`matched-${entry.id}`}>
          <h3 id={`matched-${entry.id}`}>Items matched</h3>
          <ItemList
            items={audit.matched}
            emptyCopy="No existing items were matched."
          />
        </section>
      </div>
    </div>
  )
}

export function ImportHistory({
  locationId,
  refreshKey = 0,
}: {
  locationId: string
  refreshKey?: number
}) {
  const [history, setHistory] = React.useState<HistoryEntry[]>([])
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    const load = () => {
      void fetch(
        `/api/uploads/history?locationId=${encodeURIComponent(locationId)}`,
      )
        .then(async (response) => {
          const result = (await response.json()) as {
            history?: HistoryEntry[]
            error?: string
          }
          if (!response.ok)
            throw new Error(result.error ?? 'History is unavailable.')
          if (!cancelled) {
            setError('')
            setHistory(result.history ?? [])
          }
        })
        .catch((historyError) => {
          if (!cancelled)
            setError(
              historyError instanceof Error
                ? historyError.message
                : 'Import history is unavailable.',
            )
        })
    }
    load()
    window.addEventListener('pantryiq-import-complete', load)
    return () => {
      cancelled = true
      window.removeEventListener('pantryiq-import-complete', load)
    }
  }, [locationId, refreshKey])

  return (
    <section
      className="csv-import-history"
      aria-labelledby="import-history-title"
    >
      <p className="app-page__eyebrow">Audit trail</p>
      <h2 id="import-history-title">Import history</h2>
      <p className="app-page__help">
        Imports stay here as an immutable record of what entered this location.
      </p>
      {error ? (
        <p role="alert" className="app-page__error">
          {error}
        </p>
      ) : null}
      {history.length ? (
        <div className="csv-preview__table-wrap">
          <table>
            <caption className="sr-only">CSV import history</caption>
            <thead>
              <tr>
                <th scope="col">File or entry</th>
                <th scope="col">Type</th>
                <th scope="col">Rows</th>
                <th scope="col">Imported</th>
                <th scope="col">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.filename}</td>
                  <td>{typeLabel(entry)}</td>
                  <td>{entry.rowsImported.toLocaleString()}</td>
                  <td>{new Date(entry.uploadedAt).toLocaleString()}</td>
                  <td>
                    <details>
                      <summary>View details</summary>
                      <HistoryDetails entry={entry} />
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="app-page__help">No imports for this location yet.</p>
      )}
    </section>
  )
}
