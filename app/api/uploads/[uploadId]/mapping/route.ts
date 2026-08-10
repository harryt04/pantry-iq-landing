import { headers } from 'next/headers'

import { UnauthorizedError } from '@/src/server/auth/authorization'
import {
  CsvMappingNotFoundError,
  CsvMappingValidationError,
  saveCsvMapping,
} from '@/src/server/csv/mapping-persistence'

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError)
    return Response.json({ error: error.message }, { status: 401 })
  if (error instanceof CsvMappingNotFoundError)
    return Response.json({ error: error.message }, { status: 404 })
  if (error instanceof CsvMappingValidationError)
    return Response.json({ error: error.message }, { status: 400 })
  return Response.json(
    { error: 'That mapping could not be saved. Nothing was changed.' },
    { status: 500 },
  )
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ uploadId: string }> },
) {
  try {
    const { uploadId } = await context.params
    const body = (await request.json()) as { mapping?: unknown }
    if (!body || !Object.hasOwn(body, 'mapping'))
      throw new CsvMappingValidationError()

    const saved = await saveCsvMapping(await headers(), uploadId, body.mapping)
    return Response.json({ mapping: saved.mappingUsed })
  } catch (error) {
    return errorResponse(error)
  }
}
