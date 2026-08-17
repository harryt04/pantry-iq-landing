import { headers } from 'next/headers'

import {
  CsvImportTypeUpdateError,
  CsvPreviewNotFoundError,
  updateCsvImportType,
} from '@/src/server/csv/previews'
import { UnauthorizedError } from '@/src/server/auth/authorization'
import { CSV_IMPORT_TYPES } from '@/src/server/csv/upload-input'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ uploadId: string }> },
) {
  const body = (await request.json().catch(() => null)) as {
    importType?: unknown
  } | null
  const importType = body?.importType
  if (
    typeof importType !== 'string' ||
    !(CSV_IMPORT_TYPES as readonly string[]).includes(importType)
  ) {
    return Response.json(
      { error: 'Choose a supported import type.' },
      { status: 400 },
    )
  }

  try {
    const { uploadId } = await context.params
    return Response.json(
      await updateCsvImportType(
        await headers(),
        uploadId,
        importType as (typeof CSV_IMPORT_TYPES)[number],
      ),
    )
  } catch (error) {
    if (error instanceof UnauthorizedError)
      return Response.json({ error: error.message }, { status: 401 })
    if (error instanceof CsvPreviewNotFoundError)
      return Response.json({ error: error.message }, { status: 404 })
    if (error instanceof CsvImportTypeUpdateError)
      return Response.json({ error: error.message }, { status: 409 })
    return Response.json(
      { error: 'The import type could not be changed.' },
      { status: 500 },
    )
  }
}
