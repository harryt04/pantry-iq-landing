import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { getAppShellData } from '@/components/app/app-shell-server'
import { MenuEngineeringView } from '@/components/menu-engineering/menu-engineering-view'
import { auth } from '@/src/server/auth/auth'
import { ForbiddenError } from '@/src/server/auth/authorization'
import { getMenuEngineering } from '@/src/server/menu/menu-engineering-query'

export default async function MenuEngineeringPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>
}) {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session) redirect('/sign-in')

  const shellData = await getAppShellData()
  const requestedLocationId = (await searchParams).locationId
  const locationId = shellData.locations.some(
    (location) => location.id === requestedLocationId,
  )
    ? requestedLocationId!
    : shellData.initialLocationId

  try {
    const result = await getMenuEngineering(requestHeaders, locationId)
    return (
      <AppShell {...shellData} initialLocationId={locationId}>
        <MenuEngineeringView result={result} />
      </AppShell>
    )
  } catch (error) {
    if (error instanceof ForbiddenError) notFound()
    throw error
  }
}
