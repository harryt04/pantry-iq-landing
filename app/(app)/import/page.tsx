'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import {
  Square as SquareIcon,
  Upload as UploadIcon,
  AlertCircle,
} from 'lucide-react'
import { CSVUpload, type ImportType } from '@/components/import/csv-upload'
import { SquareConnect } from '@/components/import/square-connect'
import { LocationSelector } from '@/components/import/location-selector'

function ImportContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const locationId = searchParams.get('location_id')
  const importType = (searchParams.get('import_type') ||
    'transactions') as ImportType

  if (!locationId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/30 dark:bg-yellow-950/20">
          <AlertCircle className="h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
          <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
            Please select a location to import data into.
          </p>
        </div>
        <Suspense fallback={<div>Loading locations...</div>}>
          <LocationSelector />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <SquareIcon className="h-5 w-5" />
          POS Integration
        </h2>
        <SquareConnect locationId={locationId} />
      </div>
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <UploadIcon className="h-5 w-5" />
          Manual CSV Upload
        </h2>
        <label className="mb-3 block text-sm font-medium" htmlFor="import-type">
          What kind of data are you importing?
        </label>
        <select
          id="import-type"
          value={importType}
          onChange={(event) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('import_type', event.target.value)
            router.replace(`/import?${params.toString()}`)
          }}
          className="border-input bg-background mb-4 w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="transactions">Sales transactions</option>
          <option value="purchase_orders">Purchase orders</option>
          <option value="inventory_snapshots">Inventory snapshots</option>
        </select>
        <CSVUpload locationId={locationId} importType={importType} />
      </div>
    </div>
  )
}

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Data</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Upload a CSV or TSV file to import inventory data into your location.
        </p>
      </div>

      <ImportContent />
    </div>
  )
}
