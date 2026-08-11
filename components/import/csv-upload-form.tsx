'use client'

import Link from 'next/link'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { CsvMappingReview } from '@/components/import/csv-mapping-review'
import {
  CsvItemResolution,
  type NewItemResolutionInput,
} from '@/components/import/csv-item-resolution'
import type {
  CanonicalField,
  CsvMappingDetection,
} from '@/src/server/csv/mapping'
import { normalizeExactItemName } from '@/src/server/csv/item-resolution'

type CsvPreview = {
  encoding: 'utf-8' | 'latin-1' | 'windows-1252' | 'utf-16le'
  delimiter: ',' | ';' | '\t'
  hasHeader: boolean
  columns: string[]
  columnCount: number
  rowCount: number
  readableRowCount: number
  previewRows: Array<{ rowNumber: number; values: string[] }>
  problems: Array<{ count: number; message: string; example: string }>
  mapping: CsvMappingDetection
}

type ImportSummary = {
  uploadId: string
  filename: string
  importType: string
  rowsToImport: number
  rowsImported: number
  newItems: number
  linkedItems: number
  alreadyImported: boolean
  ready: boolean
  unmatchedItems: Array<{
    rawItemName: string
    normalizedItemName: string
    reason: 'empty-name' | 'no-exact-match' | 'ambiguous-match'
    occurrenceCount: number
    rowNumbers: number[]
    context: Array<{ rowNumber: number; values: Record<string, string> }>
  }>
  items: Array<{
    id: string
    canonicalName: string
    displayName: string
    category: string | null
    unit: string
    isActive?: boolean
  }>
}

const importTypes = [
  ['transactions', 'Transactions'],
  ['purchase_orders', 'Purchase orders'],
  ['inventory', 'Inventory snapshots'],
  ['labor', 'Labor shifts'],
] as const

export function CsvUploadForm({ locationId }: { locationId: string }) {
  const [importType, setImportType] = React.useState('transactions')
  const [file, setFile] = React.useState<File | null>(null)
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState('')
  const [isUploading, setIsUploading] = React.useState(false)
  const [preview, setPreview] = React.useState<CsvPreview | null>(null)
  const [uploadId, setUploadId] = React.useState<string | null>(null)
  const [summary, setSummary] = React.useState<ImportSummary | null>(null)
  const [resolutions, setResolutions] = React.useState<
    Record<string, { itemId: string } | NewItemResolutionInput>
  >({})
  const [isCommitting, setIsCommitting] = React.useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) {
      setError('Choose a CSV file before uploading.')
      return
    }

    setError('')
    setPreview(null)
    setSummary(null)
    setResolutions({})
    setStatus('Checking the file')
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
      setUploadId(result.upload.id)
      setStatus('Reading the file')
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

  const saveMapping = React.useCallback(
    (mapping: Record<string, CanonicalField | null>) => {
      if (!uploadId) return
      void (async () => {
        try {
          const response = await fetch(
            `/api/uploads/${encodeURIComponent(uploadId)}/mapping`,
            {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ mapping }),
            },
          )
          const result = (await response.json()) as { error?: string }
          if (!response.ok)
            throw new Error(result.error ?? 'The mapping could not be saved.')
          setStatus('Mapping saved. Checking item names')
          await refreshSummary({})
        } catch (mappingError) {
          setError(
            mappingError instanceof Error
              ? mappingError.message
              : 'The mapping could not be saved. Nothing was changed.',
          )
        }
      })()
    },
    [uploadId],
  )

  async function refreshSummary(
    nextResolutions: Record<
      string,
      { itemId: string } | NewItemResolutionInput
    >,
  ) {
    if (!uploadId) return
    const response = await fetch(
      `/api/uploads/${encodeURIComponent(uploadId)}/commit`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dryRun: true, resolutions: nextResolutions }),
      },
    )
    const result = (await response.json()) as {
      summary?: ImportSummary
      error?: string
    }
    if (!response.ok && !result.summary)
      throw new Error(result.error ?? 'The import could not be prepared.')
    if (result.summary) setSummary({ ...result.summary, uploadId })
  }

  function linkExisting(rawItemName: string, itemId: string) {
    const next = {
      ...resolutions,
      [normalizeExactItemName(rawItemName)]: { itemId },
    }
    setResolutions(next)
    void refreshSummary(next).catch((refreshError) =>
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'The import could not be prepared.',
      ),
    )
  }

  function createNew(rawItemName: string, input: NewItemResolutionInput) {
    const next = {
      ...resolutions,
      [normalizeExactItemName(rawItemName)]: input,
    }
    setResolutions(next)
    void refreshSummary(next).catch((refreshError) =>
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'The import could not be prepared.',
      ),
    )
  }

  async function commit() {
    if (!uploadId || !summary?.ready) return
    setError('')
    setIsCommitting(true)
    try {
      const response = await fetch(
        `/api/uploads/${encodeURIComponent(uploadId)}/commit`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ resolutions }),
        },
      )
      const result = (await response.json()) as {
        summary?: ImportSummary
        error?: string
      }
      if (!response.ok || !result.summary)
        throw new Error(result.error ?? 'The import could not be completed.')
      setSummary({ ...result.summary, uploadId })
      setStatus(
        `${result.summary.rowsImported.toLocaleString()} rows imported. ${result.summary.newItems.toLocaleString()} new items created.`,
      )
      window.dispatchEvent(new Event('pantryiq-import-complete'))
    } catch (commitError) {
      setError(
        commitError instanceof Error
          ? commitError.message
          : 'The import could not be completed. Nothing was changed.',
      )
    } finally {
      setIsCommitting(false)
    }
  }

  return (
    <div className="app-page__form">
      <form onSubmit={submit}>
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
          {isUploading ? 'Uploading' : 'Upload CSV'}
        </Button>
      </form>
      <p aria-live="polite" className="app-page__status">
        {status}
      </p>
      {preview ? <CsvPreviewTable preview={preview} /> : null}
      {preview ? (
        <CsvMappingReview
          mapping={preview.mapping}
          preview={preview}
          onMappingAccepted={saveMapping}
        />
      ) : null}
      {summary?.unmatchedItems.length ? (
        <CsvItemResolution
          unmatchedItems={summary.unmatchedItems}
          items={summary.items}
          onLinkExisting={linkExisting}
          onCreateNew={createNew}
        />
      ) : null}
      {summary?.ready ? (
        <section
          className="csv-import-confirmation"
          aria-labelledby="csv-confirm-title"
        >
          <p className="app-page__eyebrow">Import confirmation</p>
          <h2 id="csv-confirm-title">
            Ready to import {summary.rowsToImport.toLocaleString()} rows.
          </h2>
          <p className="app-page__help">
            {summary.newItems.toLocaleString()} new items will be created.{' '}
            {summary.linkedItems.toLocaleString()} rows will link to existing
            items. Re-importing this file will not duplicate rows.
          </p>
          <Button
            type="button"
            onClick={() => void commit()}
            disabled={isCommitting || summary.alreadyImported}
          >
            {isCommitting
              ? 'Importing'
              : summary.alreadyImported
                ? 'Already imported'
                : 'Import now'}
          </Button>
          {summary.rowsImported > 0 || summary.alreadyImported ? (
            <Button asChild type="button" variant="outline">
              <Link
                href={`/dashboard?locationId=${encodeURIComponent(locationId)}`}
              >
                Continue to dashboard
              </Link>
            </Button>
          ) : null}
        </section>
      ) : null}
      {error ? (
        <p role="alert" className="app-page__error">
          {error}
        </p>
      ) : null}
    </div>
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
          {problem.message}. Here's the first one.{' '}
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
