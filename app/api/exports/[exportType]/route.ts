import { headers } from 'next/headers'

import {
  ForbiddenError,
  UnauthorizedError,
} from '@/src/server/auth/authorization'
import { exportLocationCsv, isCsvExportType } from '@/src/server/csv/exports'

export async function GET(
  request: Request,
  context: { params: Promise<{ exportType: string }> },
) {
  const locationId = new URL(request.url).searchParams.get('locationId')
  const { exportType } = await context.params

  if (!locationId || !isCsvExportType(exportType))
    return Response.json(
      { error: 'Choose a location and export type.' },
      { status: 400 },
    )

  try {
    const csv = await exportLocationCsv(await headers(), locationId, exportType)
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="pantryiq-${exportType}.csv"`,
        'cache-control': 'private, no-store',
      },
    })
  } catch (error) {
    if (error instanceof UnauthorizedError)
      return Response.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError)
      return Response.json({ error: error.message }, { status: 404 })
    return Response.json(
      { error: 'That export is not available right now.' },
      { status: 500 },
    )
  }
}
