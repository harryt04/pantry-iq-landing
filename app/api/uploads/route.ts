import { headers } from 'next/headers'

import {
  CsvUploadStorageError,
  CsvUploadValidationError,
  uploadCsv,
} from '@/src/server/csv/uploads'
import { CsvSecurityError } from '@/src/server/csv/security'
import { UnauthorizedError } from '@/src/server/auth/authorization'
import { ObjectStorageConfigurationError } from '@/src/server/storage/object-storage'

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return Response.json({ error: error.message }, { status: 401 })
  }
  if (error instanceof CsvSecurityError) {
    const status = error.code === 'LOCATION_NOT_OWNED' ? 404 : 400
    return Response.json({ error: error.message, code: error.code }, { status })
  }
  if (error instanceof CsvUploadValidationError) {
    return Response.json({ error: error.message }, { status: 400 })
  }
  if (error instanceof ObjectStorageConfigurationError) {
    return Response.json(
      { error: 'File storage is not configured. Nothing was saved.' },
      { status: 503 },
    )
  }
  if (error instanceof CsvUploadStorageError) {
    return Response.json({ error: error.message }, { status: 503 })
  }
  return Response.json(
    { error: 'The file could not be processed. Nothing was saved.' },
    { status: 500 },
  )
}

export async function POST(request: Request) {
  const locationId = new URL(request.url).searchParams.get('locationId')
  const requestHeaders = await headers()
  const filename = requestHeaders.get('x-pantryiq-filename')
  const importType = requestHeaders.get('x-pantryiq-import-type')

  if (!locationId || !filename || !importType || !request.body) {
    return Response.json(
      { error: 'Choose a location, data type, and CSV file.' },
      { status: 400 },
    )
  }

  try {
    const upload = await uploadCsv({
      headers: requestHeaders,
      locationId,
      filename,
      importType,
      body: request.body,
    })
    return Response.json({ upload }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
