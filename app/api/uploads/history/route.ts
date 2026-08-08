import { headers } from 'next/headers'

import { UnauthorizedError } from '@/src/server/auth/authorization'
import { listImportHistory } from '@/src/server/csv/imports'

export async function GET(request: Request) {
  try {
    const locationId = new URL(request.url).searchParams.get('locationId')
    if (!locationId)
      return Response.json({ error: 'Choose a location.' }, { status: 400 })
    return Response.json({
      history: await listImportHistory(await headers(), locationId),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError)
      return Response.json({ error: error.message }, { status: 401 })
    return Response.json(
      { error: 'Import history is not available.' },
      { status: 404 },
    )
  }
}
