import { headers } from 'next/headers'

import { UnauthorizedError } from '@/src/server/auth/authorization'
import {
  commitCsvImport,
  CsvImportNotFoundError,
  CsvImportUnresolvedError,
  previewCsvImport,
} from '@/src/server/csv/imports'
import { CsvImportValidationError } from '@/src/server/csv/import-plan'
import { ObjectStorageConfigurationError } from '@/src/server/storage/object-storage'

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError)
    return Response.json({ error: error.message }, { status: 401 })
  if (error instanceof CsvImportNotFoundError)
    return Response.json({ error: error.message }, { status: 404 })
  if (error instanceof CsvImportUnresolvedError)
    return Response.json(
      { error: error.message, summary: summaryFor(error.plan) },
      { status: 409 },
    )
  if (error instanceof CsvImportValidationError)
    return Response.json({ error: error.message }, { status: 400 })
  if (error instanceof ObjectStorageConfigurationError)
    return Response.json(
      { error: 'File storage is not configured. Nothing was saved.' },
      { status: 503 },
    )
  return Response.json(
    { error: 'The import could not be completed. Nothing was changed.' },
    { status: 500 },
  )
}

function summaryFor(plan: CsvImportUnresolvedError['plan']) {
  return {
    rowsToImport: plan.rows.length,
    newItems: plan.newItems.length,
    linkedItems: plan.linkedItemCount,
    ready: false,
    unmatchedItems: plan.unmatchedItems,
    items: plan.items,
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ uploadId: string }> },
) {
  try {
    const { uploadId } = await context.params
    const body = (await request.json().catch(() => ({}))) as {
      dryRun?: boolean
      resolutions?: Record<string, unknown>
    }
    const resolutions = body.resolutions as Parameters<
      typeof previewCsvImport
    >[2]
    const requestHeaders = await headers()
    const result = body.dryRun
      ? await previewCsvImport(requestHeaders, uploadId, resolutions)
      : await commitCsvImport(requestHeaders, uploadId, resolutions)
    return Response.json({ summary: result })
  } catch (error) {
    return errorResponse(error)
  }
}
