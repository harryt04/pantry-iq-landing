'use client'

import * as React from 'react'

type HistoryEntry = {
  id: string
  filename: string
  importType: string
  rowsImported: number
  status: string
  uploadedAt: string
}

const labels: Record<string, string> = {
  transactions: 'Transactions',
  purchase_orders: 'Purchase orders',
  inventory: 'Inventory snapshots',
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
          if (!cancelled) setHistory(result.history ?? [])
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
                <th scope="col">File</th>
                <th scope="col">Type</th>
                <th scope="col">Rows</th>
                <th scope="col">Imported</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.filename}</td>
                  <td>{labels[entry.importType] ?? entry.importType}</td>
                  <td>{entry.rowsImported.toLocaleString()}</td>
                  <td>{new Date(entry.uploadedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="app-page__help">
          No completed imports for this location yet.
        </p>
      )}
    </section>
  )
}
