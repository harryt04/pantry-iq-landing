'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'

const importTypes = [
  ['transactions', 'Transactions'],
  ['purchase_orders', 'Purchase orders'],
  ['inventory', 'Inventory snapshots'],
] as const

export function CsvUploadForm({ locationId }: { locationId: string }) {
  const [importType, setImportType] = React.useState('transactions')
  const [file, setFile] = React.useState<File | null>(null)
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState('')
  const [isUploading, setIsUploading] = React.useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) {
      setError('Choose a CSV file before uploading.')
      return
    }

    setError('')
    setStatus('Checking the file…')
    setIsUploading(true)

    try {
      const response = await fetch(
        `/api/uploads?locationId=${encodeURIComponent(locationId)}`,
        {
          method: 'POST',
          body: file,
          headers: {
            'content-type': 'text/csv',
            'x-pantryiq-filename': file.name,
            'x-pantryiq-import-type': importType,
          },
        },
      )
      const result = (await response.json()) as {
        upload?: { filename: string }
        error?: string
      }
      if (!response.ok)
        throw new Error(result.error ?? 'The file could not be saved.')

      setStatus(`${result.upload?.filename ?? file.name} is ready for preview.`)
      setFile(null)
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'The file could not be saved. Nothing was saved, so your existing data is untouched.',
      )
      setStatus('')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <form className="app-page__form" onSubmit={submit}>
      <div className="app-page__form-row">
        <Label htmlFor="import-type">What kind of data is this?</Label>
        <NativeSelect
          id="import-type"
          value={importType}
          onChange={(event) => setImportType(event.target.value)}
          disabled={isUploading}
        >
          {importTypes.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="app-page__form-row">
        <Label htmlFor="csv-file">CSV file</Label>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          disabled={isUploading}
        />
        <p className="app-page__help">
          CSV files up to 10 MB. The file is checked before anything is saved.
        </p>
      </div>
      <Button type="submit" disabled={isUploading || !file}>
        {isUploading ? 'Uploading…' : 'Upload CSV'}
      </Button>
      <p aria-live="polite" className="app-page__status">
        {status}
      </p>
      {error ? (
        <p role="alert" className="app-page__error">
          {error}
        </p>
      ) : null}
    </form>
  )
}
