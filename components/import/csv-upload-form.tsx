'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'

type CsvPreview = {
  encoding: 'utf-8' | 'latin-1'
  delimiter: ',' | ';' | '\t'
  hasHeader: boolean
  columns: string[]
  columnCount: number
  rowCount: number
  readableRowCount: number
  previewRows: Array<{ rowNumber: number; values: string[] }>
  problems: Array<{ count: number; message: string; example: string }>
}

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
  const [preview, setPreview] = React.useState<CsvPreview | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) {
      setError('Choose a CSV file before uploading.')
      return
    }

    setError('')
    setPreview(null)
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
        upload?: { id: string; filename: string }
        error?: string
      }
      if (!response.ok)
        throw new Error(result.error ?? 'The file could not be saved.')

      if (!result.upload?.id) throw new Error('The file could not be read.')
      setStatus('Reading the file…')
      const previewResponse = await fetch(
        `/api/uploads/${encodeURIComponent(result.upload.id)}/preview`,
      )
      const previewResult = (await previewResponse.json()) as {
        preview?: CsvPreview
        error?: string
      }
      if (!previewResponse.ok || !previewResult.preview)
        throw new Error(previewResult.error ?? 'The file could not be read.')

      setPreview(previewResult.preview)
      setStatus(`${result.upload.filename} is ready to map.`)
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
      {preview ? <CsvPreviewTable preview={preview} /> : null}
      {error ? (
        <p role="alert" className="app-page__error">
          {error}
        </p>
      ) : null}
    </form>
  )
}

function CsvPreviewTable({ preview }: { preview: CsvPreview }) {
  const delimiterName = preview.delimiter === '\t' ? 'tab' : preview.delimiter
  return (
    <section className="csv-preview" aria-labelledby="csv-preview-title">
      <div>
        <p className="app-page__eyebrow">Preview</p>
        <h2 id="csv-preview-title">A look at the first rows.</h2>
        <p className="app-page__help">
          {preview.rowCount.toLocaleString()} rows · {preview.columnCount}{' '}
          columns · {delimiterName} delimited · {preview.encoding}
        </p>
      </div>
      {preview.problems.map((problem) => (
        <p className="app-page__error" key={problem.message}>
          {problem.count} {problem.count === 1 ? 'row' : 'rows'}{' '}
          {problem.message}. Here's the first one —{' '}
          <code>{problem.example}</code>
        </p>
      ))}
      <div className="csv-preview__table-wrap">
        <table>
          <caption className="sr-only">Preview of imported CSV rows</caption>
          <thead>
            <tr>
              {preview.columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.previewRows.map((row) => (
              <tr key={row.rowNumber}>
                {preview.columns.map((column, index) => (
                  <td key={`${row.rowNumber}-${column}`}>
                    {row.values[index] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
