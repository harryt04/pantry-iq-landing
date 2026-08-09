import { cookies } from 'next/headers'

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
  const locationId =
    queryLocationId ?? (await cookies()).get('pantryiq-location-id')?.value

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
          <ManualEntryForm locationId={locationId} />
          <ImportHistory locationId={locationId} />
          <ReconciliationReview locationId={locationId} />
          <CsvExportOptions locationId={locationId} />
        </>
      ) : null}
    </main>
  )
}
