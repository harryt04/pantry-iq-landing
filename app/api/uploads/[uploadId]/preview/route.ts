import { headers } from 'next/headers'

import {
  CsvPreviewNotFoundError,
  CsvPreviewReadError,
  previewCsv,
} from '@/src/server/csv/previews'
import { UnauthorizedError } from '@/src/server/auth/authorization'
import { ObjectStorageConfigurationError } from '@/src/server/storage/object-storage'

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError)
    return Response.json({ error: error.message }, { status: 401 })
  if (error instanceof CsvPreviewNotFoundError)
    return Response.json({ error: error.message }, { status: 404 })
  if (error instanceof ObjectStorageConfigurationError)
    return Response.json(
      { error: 'File storage is not configured. Nothing was saved.' },
      { status: 503 },
    )
  if (error instanceof CsvPreviewReadError)
    return Response.json({ error: error.message }, { status: 503 })
  return Response.json(
    { error: 'That file could not be read. Nothing was changed.' },
    { status: 500 },
  )
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ uploadId: string }> },
) {
  try {
    const { uploadId } = await context.params
    return Response.json(await previewCsv(await headers(), uploadId))
  } catch (error) {
    return errorResponse(error)
  }
}
