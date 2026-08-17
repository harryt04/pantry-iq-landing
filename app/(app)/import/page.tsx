import { cookies } from 'next/headers'
import Link from 'next/link'

import { getAppShellData } from '@/components/app/app-shell-server'
import { CsvUploadForm } from '@/components/import/csv-upload-form'
import { CsvExportOptions } from '@/components/import/csv-export-options'
import { ImportHistory } from '@/components/import/import-history'
import { ManualEntryForm } from '@/components/import/manual-entry-form'
import { ReconciliationReview } from '@/components/import/reconciliation-review'

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>
}) {
  const queryLocationId = (await searchParams).locationId
  const { locations, initialLocationId } = await getAppShellData()
  const storedLocationId = (await cookies()).get('pantryiq-location-id')?.value
  const locationId =
    queryLocationId ??
    storedLocationId ??
    (locations.length === 1 ? initialLocationId : undefined)

  return (
    <main className="app-page" aria-labelledby="import-title">
      <p className="app-page__eyebrow">Import</p>
      <h1 id="import-title">Bring in one location&apos;s data.</h1>
      <p className="app-page__lede">
        Choose the kind of data, then upload a CSV. We&apos;ll check the file,
        show a preview next, and keep the original rows available for audit.
      </p>
      {locationId ? (
        <>
          <CsvUploadForm locationId={locationId} />
          <details className="import-supporting-tools">
            <summary>Other ways to add and review data</summary>
            <div className="import-supporting-tools__content">
              <ManualEntryForm locationId={locationId} />
              <ImportHistory locationId={locationId} />
              <ReconciliationReview locationId={locationId} />
              <CsvExportOptions locationId={locationId} />
            </div>
          </details>
        </>
      ) : (
        <section
          className="import-location-state"
          aria-labelledby="import-location-state-title"
        >
          <p className="app-page__eyebrow">Location required</p>
          <h2 id="import-location-state-title">
            Choose a location before importing.
          </h2>
          <p>
            Imported rows belong to one location so the dashboard and audit
            trail stay clear. Choose an existing location or add one to begin.
          </p>
          <Link className="app-page__primary-action" href="/account">
            Choose or add a location
          </Link>
        </section>
      )}
    </main>
  )
}
