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
import { detectCsvImportType } from '@/src/server/csv/mapping'
import { normalizeExactItemName } from '@/src/server/csv/item-resolution'
import type { CsvImportType } from '@/src/server/csv/upload-input'

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

type BatchImportSummary = {
  filesImported: number
  rowsImported: number
  newItems: number
  filesSkipped: Array<{ filename: string; reason: string }>
}

const importTypes = [
  ['transactions', 'Transactions'],
  ['purchase_orders', 'Purchase orders'],
  ['inventory', 'Inventory snapshots'],
  ['labor', 'Labor shifts'],
] as const

const sampleImports = [
  {
    importType: 'transactions',
    label: 'Transactions',
    filename: 'pantryiq-transactions-sample.csv',
    requiredColumns: ['Date', 'Item Name', 'Qty', 'Total Revenue'],
  },
  {
    importType: 'purchase_orders',
    label: 'Purchase orders',
    filename: 'pantryiq-purchase-orders-sample.csv',
    requiredColumns: ['Order Date', 'Item', 'Qty', 'Unit Cost'],
  },
  {
    importType: 'inventory',
    label: 'Inventory snapshots',
    filename: 'pantryiq-inventory-sample.csv',
    requiredColumns: ['Count Date', 'Item', 'Qty', 'Unit'],
  },
  {
    importType: 'labor',
    label: 'Labor shifts',
    filename: 'pantryiq-labor-sample.csv',
    requiredColumns: [
      'Shift Start',
      'Shift End',
      'Role',
      'Scheduled Hours or Actual Hours',
    ],
  },
] as const

type ItemResolution = { itemId: string } | NewItemResolutionInput

type UploadJob = {
  file: File | null
  fileName: string
  importType: CsvImportType
  detectedImportType: CsvImportType | null
  uploadId: string | null
  preview: CsvPreview | null
  mapping: CsvMappingDetection | null
  resolutions: Record<string, ItemResolution>
  summary: ImportSummary | null
  status: string
  error: string
  isUploading: boolean
  isCommitting: boolean
  isCommitted: boolean
}

type ImportStep =
  'location' | 'upload' | 'mapping' | 'resolution' | 'confirmation'

const importSteps: Array<{ id: ImportStep; label: string }> = [
  { id: 'location', label: 'Location' },
  { id: 'upload', label: 'Upload file' },
  { id: 'mapping', label: 'Map columns' },
  { id: 'resolution', label: 'Match items' },
  { id: 'confirmation', label: 'Confirm import' },
]

type PersistedUploadJob = Omit<UploadJob, 'file'>

type PersistedImportState = {
  activeJobId: string | null
  jobs: Record<string, PersistedUploadJob>
}

function importStateStorageKey(locationId: string) {
  return `pantryiq-import-jobs:${locationId}`
}

function persistedStateFor(
  jobs: Record<string, UploadJob>,
  activeJobId: string | null,
): PersistedImportState {
  return {
    activeJobId,
    jobs: Object.fromEntries(
      Object.entries(jobs)
        .filter(([, job]) => !job.isCommitted)
        .map(([jobId, job]) => [
          jobId,
          {
            fileName: job.fileName,
            importType: job.importType,
            detectedImportType: job.detectedImportType,
            uploadId: job.uploadId,
            preview: job.preview,
            mapping: job.mapping,
            resolutions: job.resolutions,
            summary: job.summary,
            status: job.status,
            error: job.error,
            isUploading: false,
            isCommitting: false,
            isCommitted: false,
          } satisfies PersistedUploadJob,
        ]),
    ),
  }
}

function readPersistedImportState(
  locationId: string,
): PersistedImportState | null {
  try {
    const raw = window.localStorage.getItem(importStateStorageKey(locationId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedImportState>
    if (!parsed.jobs || typeof parsed.jobs !== 'object') return null
    return {
      activeJobId:
        typeof parsed.activeJobId === 'string' ? parsed.activeJobId : null,
      jobs: parsed.jobs as Record<string, PersistedUploadJob>,
    }
  } catch {
    return null
  }
}

function importTypeLabel(importType: CsvImportType) {
  return importTypes.find(([value]) => value === importType)?.[1] ?? importType
}

function currentStepFor(job: UploadJob | undefined): ImportStep {
  if (!job || job.isUploading || !job.preview) return 'upload'
  if (!job.summary) return 'mapping'
  if (job.summary.unmatchedItems.length > 0) return 'resolution'
  return 'confirmation'
}

function stepStatus(
  step: ImportStep,
  currentStep: ImportStep,
): 'complete' | 'current' | 'upcoming' {
  const currentIndex = importSteps.findIndex(({ id }) => id === currentStep)
  const stepIndex = importSteps.findIndex(({ id }) => id === step)
  if (stepIndex < currentIndex) return 'complete'
  if (stepIndex === currentIndex) return 'current'
  return 'upcoming'
}

function firstCsvRecord(sample: string) {
  let quoted = false
  for (let index = 0; index < sample.length; index += 1) {
    const character = sample[index]
    if (character === '"') {
      if (quoted && sample[index + 1] === '"') {
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (!quoted && (character === '\n' || character === '\r')) {
      return sample.slice(0, index)
    }
  }
  return sample
}

function detectDelimiter(header: string): ',' | ';' | '\t' {
  const delimiters = [',', ';', '\t'] as const
  return delimiters.reduce((best, delimiter) => {
    const currentCount = [...header].filter(
      (character) => character === delimiter,
    ).length
    const bestCount = [...header].filter(
      (character) => character === best,
    ).length
    return currentCount > bestCount ? delimiter : best
  }, ',')
}

function parseCsvHeader(record: string, delimiter: ',' | ';' | '\t') {
  const columns: string[] = []
  let value = ''
  let quoted = false
  for (let index = 0; index < record.length; index += 1) {
    const character = record[index]
    if (character === '"') {
      if (quoted && record[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (!quoted && character === delimiter) {
      columns.push(value.replace(/^\uFEFF/, '').trim())
      value = ''
    } else {
      value += character
    }
  }
  columns.push(value.replace(/^\uFEFF/, '').trim())
  return columns
}

async function detectImportType(file: File): Promise<CsvImportType> {
  const sample = (await file.slice(0, 64 * 1024).text()).replace(/^\uFEFF/, '')
  const header = firstCsvRecord(sample)
  const columns = parseCsvHeader(header, detectDelimiter(header))
  return detectCsvImportType(columns).importType
}

export function CsvUploadForm({ locationId }: { locationId: string }) {
  const [jobs, setJobs] = React.useState<Record<string, UploadJob>>({})
  const [activeJobId, setActiveJobId] = React.useState<string | null>(null)
  const [batchSummary, setBatchSummary] =
    React.useState<BatchImportSummary | null>(null)
  const [isBatchCommitting, setIsBatchCommitting] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const [storageHydrated, setStorageHydrated] = React.useState(false)
  const nextJobId = React.useRef(0)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const resumedJobs = React.useRef(false)

  function updateJob(jobId: string, update: (job: UploadJob) => UploadJob) {
    setJobs((currentJobs) => {
      const job = currentJobs[jobId]
      if (!job) return currentJobs
      return { ...currentJobs, [jobId]: update(job) }
    })
  }

  React.useEffect(() => {
    const persisted = readPersistedImportState(locationId)
    if (persisted) {
      setJobs(
        Object.fromEntries(
          Object.entries(persisted.jobs).map(([jobId, job]) => [
            jobId,
            { ...job, file: null, isCommitted: Boolean(job.isCommitted) },
          ]),
        ),
      )
      setActiveJobId(persisted.activeJobId)
    }
    setStorageHydrated(true)
  }, [locationId])

  React.useEffect(() => {
    if (!storageHydrated) return
    window.localStorage.setItem(
      importStateStorageKey(locationId),
      JSON.stringify(persistedStateFor(jobs, activeJobId)),
    )
  }, [activeJobId, jobs, locationId, storageHydrated])

  React.useEffect(() => {
    if (!storageHydrated || resumedJobs.current) return
    resumedJobs.current = true

    const savedJobs = Object.entries(jobs).filter(
      ([, job]) => job.uploadId && !job.isUploading,
    )
    for (const [jobId, savedJob] of savedJobs) {
      const uploadId = savedJob.uploadId
      if (!uploadId) continue

      void (async () => {
        try {
          const previewResponse = await fetch(
            `/api/uploads/${encodeURIComponent(uploadId)}/preview`,
          )
          const previewResult = (await previewResponse.json()) as {
            upload?: { source: CsvImportType; filename: string }
            preview?: CsvPreview
            error?: string
          }
          if (!previewResponse.ok || !previewResult.preview)
            throw new Error(
              previewResult.error ?? 'The saved file could not be resumed.',
            )

          updateJob(jobId, (job) => ({
            ...job,
            fileName: previewResult.upload?.filename ?? job.fileName,
            importType: previewResult.upload?.source ?? job.importType,
            detectedImportType:
              previewResult.upload?.source ?? job.detectedImportType,
            preview: previewResult.preview!,
            mapping: previewResult.preview!.mapping,
            status: `${job.fileName} resumed. Checking item names.`,
            error: '',
          }))

          const summaryResponse = await fetch(
            `/api/uploads/${encodeURIComponent(uploadId)}/commit`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                dryRun: true,
                resolutions: savedJob.resolutions,
              }),
            },
          )
          const summaryResult = (await summaryResponse.json()) as {
            summary?: ImportSummary
            error?: string
          }
          if (!summaryResponse.ok && !summaryResult.summary)
            throw new Error(
              summaryResult.error ?? 'The saved import could not be resumed.',
            )
          if (summaryResult.summary)
            updateJob(jobId, (job) => ({
              ...job,
              summary: { ...summaryResult.summary!, uploadId },
              resolutions: savedJob.resolutions,
              status: job.summary?.ready
                ? job.status
                : `${job.fileName} is ready to continue.`,
            }))
        } catch (resumeError) {
          updateJob(jobId, (job) => ({
            ...job,
            error:
              resumeError instanceof Error
                ? resumeError.message
                : 'The saved import could not be resumed.',
          }))
        }
      })()
    }
  }, [jobs, storageHydrated])

  async function uploadFile(
    jobId: string,
    selectedFile: File,
    selectedImportType: string,
    prepareAutomatically = false,
  ) {
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
        status: `${selectedFile.name} is being read.`,
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
        status: `${selectedFile.name} is ready to map.`,
        isUploading: false,
      }))
      if (
        prepareAutomatically &&
        previewResult.preview!.mapping.columns.every(
          (column) => column.band === 'auto',
        )
      ) {
        await refreshSummary(jobId, result.upload.id, {})
      }
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

  async function detectAndUpload(
    jobId: string,
    selectedFile: File,
    prepareAutomatically = false,
  ) {
    try {
      const detectedImportType = await detectImportType(selectedFile)
      updateJob(jobId, (job) => ({
        ...job,
        importType: detectedImportType,
        detectedImportType,
        status: `${selectedFile.name} detected as ${importTypeLabel(detectedImportType)}. Checking the file`,
      }))
      await uploadFile(
        jobId,
        selectedFile,
        detectedImportType,
        prepareAutomatically,
      )
    } catch (detectionError) {
      updateJob(jobId, (job) => ({
        ...job,
        error:
          detectionError instanceof Error
            ? detectionError.message
            : 'The file type could not be detected. Choose a type and try again.',
        status: '',
        isUploading: false,
      }))
    }
  }

  function removeJob(jobId: string) {
    setBatchSummary(null)
    setJobs((currentJobs) => {
      const nextJobs = { ...currentJobs }
      delete nextJobs[jobId]
      return nextJobs
    })
    setActiveJobId((currentJobId) => {
      if (currentJobId !== jobId) return currentJobId
      return (
        Object.keys(jobs).find((remainingJobId) => remainingJobId !== jobId) ??
        null
      )
    })
  }

  function retryJob(jobId: string, job: UploadJob) {
    if (!job.file) {
      updateJob(jobId, (currentJob) => ({
        ...currentJob,
        error: 'Choose the file again to retry this upload.',
      }))
      fileInputRef.current?.click()
      return
    }
    setActiveJobId(jobId)
    updateJob(jobId, (currentJob) => ({
      ...currentJob,
      uploadId: null,
      preview: null,
      mapping: null,
      resolutions: {},
      summary: null,
      status: 'Checking the file',
      error: '',
      isUploading: true,
      isCommitting: false,
      isCommitted: false,
    }))
    void detectAndUpload(jobId, job.file)
  }

  function startUploads(files: File[]) {
    if (!files.length) return

    setBatchSummary(null)

    const entries = files.map((selectedFile) => {
      const jobId = `upload-job-${nextJobId.current++}`
      return {
        jobId,
        selectedFile,
        job: {
          file: selectedFile,
          fileName: selectedFile.name,
          importType: 'transactions',
          detectedImportType: null,
          uploadId: null,
          preview: null,
          mapping: null,
          resolutions: {},
          summary: null,
          status: 'Checking the file',
          error: '',
          isUploading: true,
          isCommitting: false,
          isCommitted: false,
        } satisfies UploadJob,
      }
    })

    setJobs((currentJobs) => ({
      ...currentJobs,
      ...Object.fromEntries(entries.map(({ jobId, job }) => [jobId, job])),
    }))
    setActiveJobId(entries[0]?.jobId ?? null)

    for (const [index, { jobId, selectedFile }] of entries.entries()) {
      void detectAndUpload(jobId, selectedFile, index > 0)
    }
  }

  function overrideImportType(
    jobId: string,
    job: UploadJob,
    importType: CsvImportType,
  ) {
    updateJob(jobId, (job) => ({
      ...job,
      importType,
      status: `${job.fileName} is updating to ${importTypeLabel(importType)}.`,
    }))

    if (!job.uploadId || !job.preview) return
    const uploadId = job.uploadId

    void (async () => {
      try {
        const response = await fetch(
          `/api/uploads/${encodeURIComponent(uploadId)}/type`,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ importType }),
          },
        )
        const result = (await response.json()) as { error?: string }
        if (!response.ok)
          throw new Error(
            result.error ?? 'The import type could not be changed.',
          )

        const previewResponse = await fetch(
          `/api/uploads/${encodeURIComponent(uploadId)}/preview`,
        )
        const previewResult = (await previewResponse.json()) as {
          preview?: CsvPreview
          error?: string
        }
        if (!previewResponse.ok || !previewResult.preview)
          throw new Error(previewResult.error ?? 'The file could not be read.')

        updateJob(jobId, (currentJob) => ({
          ...currentJob,
          importType,
          preview: previewResult.preview!,
          mapping: previewResult.preview!.mapping,
          resolutions: {},
          summary: null,
          status: `${currentJob.fileName} is ready to map as ${importTypeLabel(importType)}.`,
          error: '',
        }))
      } catch (overrideError) {
        updateJob(jobId, (currentJob) => ({
          ...currentJob,
          error:
            overrideError instanceof Error
              ? overrideError.message
              : 'The import type could not be changed.',
        }))
      }
    })()
  }

  function chooseFiles(event: React.ChangeEvent<HTMLInputElement>) {
    startUploads(Array.from(event.target.files ?? []))
    // Allow the same file to be chosen again after a failed upload.
    event.target.value = ''
  }

  function dropFiles(event: React.DragEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsDragging(false)
    startUploads(Array.from(event.dataTransfer.files))
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
    resolutions: Record<string, ItemResolution>,
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
        await refreshSummary(jobId, uploadId, resolutions)
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

  async function commitUpload(jobId: string, job: UploadJob) {
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
        isCommitted: true,
        status: `${result.summary!.rowsImported.toLocaleString()} rows imported. ${result.summary!.newItems.toLocaleString()} new items created.`,
      }))
      return { ...result.summary, uploadId: job.uploadId }
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

  async function commit(jobId: string, job: UploadJob) {
    const summary = await commitUpload(jobId, job)
    if (!summary) return
    const nextJob = jobEntries.find(
      ([nextJobId, nextJob]) =>
        nextJobId !== jobId && !nextJob.isCommitted && nextJob.summary?.ready,
    )
    if (nextJob) setActiveJobId(nextJob[0])
    window.dispatchEvent(new Event('pantryiq-import-complete'))
  }

  async function commitReadyBatch() {
    if (isBatchCommitting || readyJobEntries.length < 2) return

    setIsBatchCommitting(true)
    const results: Array<{ job: UploadJob; summary: ImportSummary }> = []
    try {
      for (const [jobId, job] of readyJobEntries) {
        if (!job.summary?.ready) continue
        if (job.summary.alreadyImported) {
          updateJob(jobId, (currentJob) => ({
            ...currentJob,
            isCommitted: true,
            status: `${currentJob.fileName} was already imported.`,
          }))
          results.push({ job, summary: job.summary })
          continue
        }

        const summary = await commitUpload(jobId, job)
        if (!summary) return
        results.push({ job, summary })
      }

      setBatchSummary({
        filesImported: results.filter(({ summary }) => !summary.alreadyImported)
          .length,
        rowsImported: results.reduce(
          (total, { summary }) => total + summary.rowsImported,
          0,
        ),
        newItems: results.reduce(
          (total, { summary }) => total + summary.newItems,
          0,
        ),
        filesSkipped: results
          .filter(({ summary }) => summary.alreadyImported)
          .map(({ job }) => ({
            filename: job.fileName,
            reason: 'Already imported',
          })),
      })
      window.dispatchEvent(new Event('pantryiq-import-complete'))
    } finally {
      setIsBatchCommitting(false)
    }
  }

  const jobEntries = Object.entries(jobs)
  const readyJobEntries = jobEntries.filter(
    ([, job]) => job.summary?.ready && !job.isCommitted,
  )
  const activeJob = activeJobId ? jobs[activeJobId] : undefined
  const currentStep = currentStepFor(activeJob)
  return (
    <div className="app-page__form">
      <nav className="csv-import-steps" aria-label="Import steps">
        <p className="app-page__eyebrow">Your import</p>
        <ol>
          {importSteps.map(({ id, label }) => {
            const status = stepStatus(id, currentStep)
            return (
              <li
                key={id}
                className={`csv-import-step csv-import-step--${status}`}
                aria-current={status === 'current' ? 'step' : undefined}
              >
                <span className="csv-import-step__number" aria-hidden="true">
                  {importSteps.findIndex((step) => step.id === id) + 1}
                </span>
                <span className="csv-import-step__label">{label}</span>
                <span className="csv-import-step__status">
                  {status === 'complete'
                    ? 'Done'
                    : status === 'current'
                      ? 'Current'
                      : 'Next'}
                </span>
              </li>
            )
          })}
        </ol>
      </nav>
      {batchSummary ? (
        <section
          className="csv-batch-summary"
          aria-labelledby="csv-batch-summary-title"
        >
          <p className="app-page__eyebrow">Batch import</p>
          <h2 id="csv-batch-summary-title">Batch import complete.</h2>
          <p className="app-page__help">
            {batchSummary.filesImported.toLocaleString()} files imported ·{' '}
            {batchSummary.rowsImported.toLocaleString()} rows imported ·{' '}
            {batchSummary.newItems.toLocaleString()} new items created.
          </p>
          {batchSummary.filesSkipped.length > 0 ? (
            <div>
              <p className="app-page__help">Files skipped:</p>
              <ul>
                {batchSummary.filesSkipped.map(({ filename, reason }) => (
                  <li key={filename}>
                    {filename}: {reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="app-page__help">Files skipped: None</p>
          )}
        </section>
      ) : null}
      {readyJobEntries.length > 1 && !batchSummary ? (
        <section className="csv-batch-action" aria-labelledby="csv-batch-title">
          <div>
            <p className="app-page__eyebrow">Ready together</p>
            <h2 id="csv-batch-title">
              {readyJobEntries.length.toLocaleString()} files are ready.
            </h2>
            <p className="app-page__help">
              Import the ready files together and review one combined summary.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => void commitReadyBatch()}
            disabled={isBatchCommitting}
          >
            {isBatchCommitting
              ? 'Importing batch'
              : `Import ${readyJobEntries.length.toLocaleString()} ready files`}
          </Button>
        </section>
      ) : null}
      <section
        className="csv-import-samples"
        aria-labelledby="csv-import-samples-title"
      >
        <div>
          <p className="app-page__eyebrow">Before you upload</p>
          <h2 id="csv-import-samples-title">Start with a clean example.</h2>
          <p className="app-page__help">
            Download a sample for the kind of data you have. Your export can use
            different column names; PantryIQ will show you the mapping before
            anything is imported.
          </p>
        </div>
        <div className="csv-import-samples__grid">
          {sampleImports.map((sample) => (
            <article className="csv-import-sample" key={sample.importType}>
              <h3>{sample.label}</h3>
              <p className="app-page__help">Required columns</p>
              <ul>
                {sample.requiredColumns.map((column) => (
                  <li key={column}>{column}</li>
                ))}
              </ul>
              <Button asChild variant="outline">
                <a
                  className="csv-import-sample__download"
                  href={`/import-samples/${sample.filename}`}
                  download={sample.filename}
                >
                  Download {sample.label.toLowerCase()} sample CSV
                </a>
              </Button>
            </article>
          ))}
        </div>
      </section>
      <form
        className={`csv-upload-dropzone${isDragging ? 'is-dragging' : ''}`}
        aria-label="CSV upload drop zone"
        onDragEnter={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={dropFiles}
        onSubmit={(event) => event.preventDefault()}
      >
        {/* Kept for existing deep-link automation; the visible type control is per file below. */}
        <select
          id="import-type"
          aria-label="Legacy import type automation control"
          className="sr-only"
          tabIndex={-1}
        >
          {importTypes.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div className="app-page__form-row">
          <Label htmlFor="csv-file">CSV files</Label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            aria-label="CSV file"
            className="csv-upload__input"
            multiple
            onChange={chooseFiles}
            ref={fileInputRef}
          />
          <p className="app-page__help">
            Drop one or more CSV files here, or use Upload CSV. Each file starts
            as soon as it is chosen. CSV files up to 10 MB are checked before
            anything is saved.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload CSV"
        >
          Upload CSV
        </Button>
      </form>
      {jobEntries.map(([jobId, job]) => (
        <section
          key={jobId}
          className="csv-upload-job"
          aria-labelledby={`${jobId}-title`}
        >
          <h2 id={`${jobId}-title`}>{job.fileName}</h2>
          <div className="csv-upload-job__type">
            <Label htmlFor={`${jobId}-type`}>
              {job.detectedImportType ? 'Detected as' : 'Detecting data type'}
            </Label>
            <NativeSelect
              id={`${jobId}-type`}
              aria-label={`Import type for ${job.fileName}`}
              value={job.importType}
              onChange={(event) =>
                overrideImportType(
                  jobId,
                  job,
                  event.target.value as CsvImportType,
                )
              }
              disabled={
                !job.detectedImportType || !job.uploadId || !job.preview
              }
            >
              {importTypes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <p aria-live="polite" className="app-page__status">
            {job.status}
          </p>
          {jobId !== activeJobId && job.preview ? (
            <div className="csv-upload-job__waiting">
              <p>
                This file is ready. Finish the active file first, or switch here
                when you are ready.
              </p>
              <Button type="button" onClick={() => setActiveJobId(jobId)}>
                Work on {job.fileName}
              </Button>
            </div>
          ) : null}
          {job.preview ? (
            <CsvPreviewTable
              preview={job.preview}
              filename={job.fileName}
              titleId={
                jobId === 'upload-job-0'
                  ? 'csv-preview-title'
                  : `${jobId}-preview-title`
              }
            />
          ) : null}
          {jobId === activeJobId && job.preview && job.mapping ? (
            <CsvMappingReview
              mapping={job.mapping}
              preview={job.preview}
              onMappingAccepted={(mapping) => {
                if (!job.uploadId) return
                const mappingUnchanged = Object.entries(
                  job.mapping?.mapping ?? {},
                ).every(([column, field]) => mapping[column] === field)
                saveMapping(
                  jobId,
                  job.uploadId,
                  mapping,
                  mappingUnchanged ? job.resolutions : {},
                )
              }}
            />
          ) : null}
          {jobId === activeJobId &&
          job.summary?.unmatchedItems.length &&
          job.uploadId ? (
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
          {jobId === activeJobId && job.summary?.ready && job.isCommitted ? (
            <section
              className="csv-import-result"
              aria-labelledby={`${jobId}-result-title`}
              aria-live="polite"
            >
              <p className="app-page__eyebrow">Import complete</p>
              <h2 id={`${jobId}-result-title`}>
                Imported {job.summary.rowsImported.toLocaleString()} rows.
              </h2>
              <p className="app-page__help">
                {job.summary.newItems.toLocaleString()} new items created.{' '}
                {job.summary.linkedItems.toLocaleString()} rows linked to
                existing items.
              </p>
              <Button asChild type="button" variant="outline">
                <Link
                  href={`/dashboard?locationId=${encodeURIComponent(locationId)}`}
                >
                  Continue to dashboard
                </Link>
              </Button>
            </section>
          ) : null}
          {jobId === activeJobId && job.summary?.ready && !job.isCommitted ? (
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
            </section>
          ) : null}
          {job.error ? (
            <>
              <p role="alert" className="app-page__error">
                {job.error}
              </p>
              <div className="csv-upload-job__actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => retryJob(jobId, job)}
                  disabled={job.isUploading}
                >
                  Try again with {job.fileName}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => removeJob(jobId)}
                >
                  Remove {job.fileName}
                </Button>
              </div>
            </>
          ) : null}
        </section>
      ))}
    </div>
  )
}

function CsvPreviewTable({
  preview,
  filename,
  titleId,
}: {
  preview: CsvPreview
  filename: string
  titleId: string
}) {
  const delimiterName = preview.delimiter === '\t' ? 'tab' : preview.delimiter
  return (
    <section className="csv-preview" aria-label={`Preview of ${filename}`}>
      <div>
        <p className="app-page__eyebrow">Preview</p>
        <h2 id={titleId}>A look at the first rows.</h2>
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
      <div
        className="csv-preview__table-wrap"
        tabIndex={0}
        aria-label="Scroll to see all imported columns"
      >
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
