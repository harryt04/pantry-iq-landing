import { cookies } from 'next/headers'

import { CsvUploadForm } from '@/components/import/csv-upload-form'

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
      {locationId ? <CsvUploadForm locationId={locationId} /> : null}
    </main>
  )
}
