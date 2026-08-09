'use client'

import * as React from 'react'

type ReconciliationConflict = {
  id: string
  recordKind: string
  conflictType: 'external-id' | 'period-overlap'
  externalId: string | null
  periodStart: string
  periodEnd: string
  sources: string[]
  status: 'unresolved' | 'resolved'
  authoritySource: string | null
  details: { message: string }
}

function recordLabel(kind: string) {
  if (kind === 'purchase_order') return 'purchase orders'
  if (kind === 'inventory') return 'inventory counts'
  return 'transactions'
}

function sourceLabel(source: string) {
  return source === 'csv' ? 'CSV' : source
}

export function ReconciliationReview({ locationId }: { locationId: string }) {
  const [conflicts, setConflicts] = React.useState<ReconciliationConflict[]>([])
  const [error, setError] = React.useState('')
  const [savingId, setSavingId] = React.useState('')

  const load = React.useCallback(() => {
    void fetch(
      `/api/reconciliation?locationId=${encodeURIComponent(locationId)}`,
    )
      .then(async (response) => {
        const result = (await response.json()) as {
          conflicts?: ReconciliationConflict[]
          error?: string
        }
        if (!response.ok)
          throw new Error(result.error ?? 'Reconciliation is unavailable.')
        setConflicts(result.conflicts ?? [])
        setError('')
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Reconciliation is unavailable.',
        )
      })
  }, [locationId])

  React.useEffect(() => {
    load()
    window.addEventListener('pantryiq-import-complete', load)
    return () => window.removeEventListener('pantryiq-import-complete', load)
  }, [load])

  async function chooseAuthority(
    conflict: ReconciliationConflict,
    authoritySource: string,
  ) {
    setSavingId(conflict.id)
    setError('')
    try {
      const response = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          locationId,
          conflictId: conflict.id,
          authoritySource,
        }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok)
        throw new Error(result.error ?? 'That source choice was not saved.')
      await load()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'That source choice was not saved.',
      )
    } finally {
      setSavingId('')
    }
  }

  const unresolved = conflicts.filter(
    (conflict) => conflict.status === 'unresolved',
  )

  return (
    <section
      className="reconciliation-review"
      aria-labelledby="reconciliation-title"
    >
      <p className="app-page__eyebrow">Source review</p>
      <h2 id="reconciliation-title">Keep overlapping data honest.</h2>
      <p className="app-page__help">
        Rows with the same source ID are counted once. When sources overlap
        without a stable ID, PantryIQ leaves that period out until you choose
        which source to use.
      </p>
      {error ? (
        <p role="alert" className="app-page__error">
          {error}
        </p>
      ) : null}
      {unresolved.length > 0 ? (
        <div className="reconciliation-review__list">
          {unresolved.map((conflict) => (
            <article className="reconciliation-review__item" key={conflict.id}>
              <div>
                <h3>
                  {recordLabel(conflict.recordKind)} overlap{' '}
                  <span className="figure">
                    {new Date(conflict.periodStart).toLocaleDateString()} –{' '}
                    {new Date(conflict.periodEnd).toLocaleDateString()}
                  </span>
                </h3>
                <p>{conflict.details.message}</p>
              </div>
              <div className="reconciliation-review__choice">
                <label htmlFor={`authority-${conflict.id}`}>
                  Use this source for the overlap
                </label>
                <select
                  id={`authority-${conflict.id}`}
                  defaultValue=""
                  disabled={savingId === conflict.id}
                  onChange={(event) => {
                    if (event.target.value)
                      void chooseAuthority(conflict, event.target.value)
                  }}
                >
                  <option value="">Choose a source</option>
                  {conflict.sources.map((source) => (
                    <option key={source} value={source}>
                      {sourceLabel(source)}
                    </option>
                  ))}
                </select>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="reconciliation-review__status" role="status">
          No unresolved source overlaps.
        </p>
      )}
      {conflicts.some((conflict) => conflict.conflictType === 'external-id') ? (
        <p className="app-page__help">
          Repeated source IDs are recorded in the evidence trace with the
          retained source, so a re-import does not inflate the dashboard.
        </p>
      ) : null}
    </section>
  )
}
