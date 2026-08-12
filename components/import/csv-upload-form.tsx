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

type ItemResolution = { itemId: string } | NewItemResolutionInput

type UploadJob = {
  fileName: string
  importType: string
  uploadId: string | null
  preview: CsvPreview | null
  mapping: CsvMappingDetection | null
  resolutions: Record<string, ItemResolution>
  summary: ImportSummary | null
  status: string
  error: string
  isUploading: boolean
  isCommitting: boolean
}

export function CsvUploadForm({ locationId }: { locationId: string }) {
  const [importType, setImportType] = React.useState('transactions')
  const [file, setFile] = React.useState<File | null>(null)
  const [jobs, setJobs] = React.useState<Record<string, UploadJob>>({})
  const nextJobId = React.useRef(0)

  function updateJob(jobId: string, update: (job: UploadJob) => UploadJob) {
    setJobs((currentJobs) => {
      const job = currentJobs[jobId]
      if (!job) return currentJobs
      return { ...currentJobs, [jobId]: update(job) }
    })
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) {
      return
    }

    const jobId = `upload-job-${nextJobId.current++}`
    const selectedFile = file
    const selectedImportType = importType
    setJobs((currentJobs) => ({
      ...currentJobs,
      [jobId]: {
        fileName: selectedFile.name,
        importType: selectedImportType,
        uploadId: null,
        preview: null,
        mapping: null,
        resolutions: {},
        summary: null,
        status: 'Checking the file',
        error: '',
        isUploading: true,
        isCommitting: false,
      },
    }))

    try {
      const response = await fetch(
        `/api/uploads?locationId=${encodeURIComponent(locationId)}`,
        {
          method: 'POST',
          body: selectedFile,
          headers: {
            'content-type': 'text/csv',
            'x-pantryiq-filename': selectedFile.name,
            'x-pantryiq-import-type': selectedImportType,
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
      updateJob(jobId, (job) => ({
        ...job,
        uploadId: result.upload!.id,
        status: 'Reading the file',
      }))
      const previewResponse = await fetch(
        `/api/uploads/${encodeURIComponent(result.upload.id)}/preview`,
      )
      const previewResult = (await previewResponse.json()) as {
        preview?: CsvPreview
        error?: string
      }
      if (!previewResponse.ok || !previewResult.preview)
        throw new Error(previewResult.error ?? 'The file could not be read.')

      updateJob(jobId, (job) => ({
        ...job,
        preview: previewResult.preview!,
        mapping: previewResult.preview!.mapping,
        status: `${result.upload!.filename} is ready to map.`,
        isUploading: false,
      }))
      setFile(null)
    } catch (uploadError) {
      updateJob(jobId, (job) => ({
        ...job,
        error:
          uploadError instanceof Error
            ? uploadError.message
            : 'The file could not be saved. Nothing was saved, so your existing data is untouched.',
        status: '',
        isUploading: false,
      }))
    } finally {
      updateJob(jobId, (job) => ({ ...job, isUploading: false }))
    }
  }

  async function refreshSummary(
    jobId: string,
    uploadId: string,
    nextResolutions: Record<string, ItemResolution>,
  ) {
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
    if (result.summary)
      updateJob(jobId, (job) => ({
        ...job,
        summary: { ...result.summary!, uploadId },
        resolutions: nextResolutions,
        error: '',
      }))
  }

  function saveMapping(
    jobId: string,
    uploadId: string,
    mapping: Record<string, CanonicalField | null>,
  ) {
    void (async () => {
      try {
        updateJob(jobId, (job) => ({
          ...job,
          error: '',
        }))
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
        updateJob(jobId, (job) => ({
          ...job,
          status: 'Mapping saved. Checking item names',
        }))
        await refreshSummary(jobId, uploadId, {})
      } catch (mappingError) {
        updateJob(jobId, (job) => ({
          ...job,
          error:
            mappingError instanceof Error
              ? mappingError.message
              : 'The mapping could not be saved. Nothing was changed.',
        }))
      }
    })()
  }

  function linkExisting(
    jobId: string,
    uploadId: string,
    resolutions: Record<string, ItemResolution>,
    rawItemName: string,
    itemId: string,
  ) {
    const next: Record<string, ItemResolution> = {
      ...resolutions,
      [normalizeExactItemName(rawItemName)]: { itemId },
    }
    void refreshSummary(jobId, uploadId, next).catch((refreshError) =>
      updateJob(jobId, (job) => ({
        ...job,
        error:
          refreshError instanceof Error
            ? refreshError.message
            : 'The import could not be prepared.',
      })),
    )
  }

  function createNew(
    jobId: string,
    uploadId: string,
    resolutions: Record<string, ItemResolution>,
    rawItemName: string,
    input: NewItemResolutionInput,
  ) {
    const next: Record<string, ItemResolution> = {
      ...resolutions,
      [normalizeExactItemName(rawItemName)]: input,
    }
    void refreshSummary(jobId, uploadId, next).catch((refreshError) =>
      updateJob(jobId, (job) => ({
        ...job,
        error:
          refreshError instanceof Error
            ? refreshError.message
            : 'The import could not be prepared.',
      })),
    )
  }

  async function commit(jobId: string, job: UploadJob) {
    if (!job.uploadId || !job.summary?.ready) return
    updateJob(jobId, (currentJob) => ({
      ...currentJob,
      error: '',
      isCommitting: true,
    }))
    try {
      const response = await fetch(
        `/api/uploads/${encodeURIComponent(job.uploadId)}/commit`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ resolutions: job.resolutions }),
        },
      )
      const result = (await response.json()) as {
        summary?: ImportSummary
        error?: string
      }
      if (!response.ok || !result.summary)
        throw new Error(result.error ?? 'The import could not be completed.')
      updateJob(jobId, (currentJob) => ({
        ...currentJob,
        summary: { ...result.summary!, uploadId: job.uploadId! },
        status: `${result.summary!.rowsImported.toLocaleString()} rows imported. ${result.summary!.newItems.toLocaleString()} new items created.`,
      }))
      window.dispatchEvent(new Event('pantryiq-import-complete'))
    } catch (commitError) {
      updateJob(jobId, (currentJob) => ({
        ...currentJob,
        error:
          commitError instanceof Error
            ? commitError.message
            : 'The import could not be completed. Nothing was changed.',
      }))
    } finally {
      updateJob(jobId, (currentJob) => ({
        ...currentJob,
        isCommitting: false,
      }))
    }
  }

  const jobEntries = Object.entries(jobs)
  const hasUploadingJob = jobEntries.some(([, job]) => job.isUploading)

  return (
    <div className="app-page__form">
      <form onSubmit={submit}>
        <div className="app-page__form-row">
          <Label htmlFor="import-type">What kind of data is this?</Label>
          <NativeSelect
            id="import-type"
            value={importType}
            onChange={(event) => setImportType(event.target.value)}
            disabled={hasUploadingJob}
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
            disabled={hasUploadingJob}
          />
          <p className="app-page__help">
            CSV files up to 10 MB. The file is checked before anything is saved.
          </p>
        </div>
        <Button type="submit" disabled={hasUploadingJob || !file}>
          {hasUploadingJob ? 'Uploading' : 'Upload CSV'}
        </Button>
      </form>
      {jobEntries.map(([jobId, job]) => (
        <section
          key={jobId}
          className="csv-upload-job"
          aria-labelledby={`${jobId}-title`}
        >
          <h2 id={`${jobId}-title`}>{job.fileName}</h2>
          <p aria-live="polite" className="app-page__status">
            {job.status}
          </p>
          {job.preview ? <CsvPreviewTable preview={job.preview} /> : null}
          {job.preview && job.mapping ? (
            <CsvMappingReview
              mapping={job.mapping}
              preview={job.preview}
              onMappingAccepted={(mapping) =>
                job.uploadId
                  ? saveMapping(jobId, job.uploadId, mapping)
                  : undefined
              }
            />
          ) : null}
          {job.summary?.unmatchedItems.length && job.uploadId ? (
            <CsvItemResolution
              unmatchedItems={job.summary.unmatchedItems}
              items={job.summary.items}
              onLinkExisting={(rawItemName, itemId) =>
                linkExisting(
                  jobId,
                  job.uploadId!,
                  job.resolutions,
                  rawItemName,
                  itemId,
                )
              }
              onCreateNew={(rawItemName, input) =>
                createNew(
                  jobId,
                  job.uploadId!,
                  job.resolutions,
                  rawItemName,
                  input,
                )
              }
            />
          ) : null}
          {job.summary?.ready ? (
            <section
              className="csv-import-confirmation"
              aria-labelledby={`${jobId}-confirm-title`}
            >
              <p className="app-page__eyebrow">Import confirmation</p>
              <h2 id={`${jobId}-confirm-title`}>
                Ready to import {job.summary.rowsToImport.toLocaleString()}{' '}
                rows.
              </h2>
              <p className="app-page__help">
                {job.summary.newItems.toLocaleString()} new items will be
                created. {job.summary.linkedItems.toLocaleString()} rows will
                link to existing items. Re-importing this file will not
                duplicate rows.
              </p>
              <Button
                type="button"
                onClick={() => void commit(jobId, job)}
                disabled={job.isCommitting || job.summary.alreadyImported}
              >
                {job.isCommitting
                  ? 'Importing'
                  : job.summary.alreadyImported
                    ? 'Already imported'
                    : 'Import now'}
              </Button>
              {job.summary.rowsImported > 0 || job.summary.alreadyImported ? (
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
          {job.error ? (
            <p role="alert" className="app-page__error">
              {job.error}
            </p>
          ) : null}
        </section>
      ))}
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
