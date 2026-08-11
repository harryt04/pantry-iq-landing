import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { getAppShellData } from '@/components/app/app-shell-server'
import { UsageVarianceView } from '@/components/menu/usage-variance-view'
import { auth } from '@/src/server/auth/auth'
import { ForbiddenError } from '@/src/server/auth/authorization'
import { getUsageVariance } from '@/src/server/menu/usage-variance-query'

export default async function UsagePage({
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
    const result = await getUsageVariance(requestHeaders, locationId)
    return <UsageVarianceView result={result} />
  } catch (error) {
    if (error instanceof ForbiddenError) notFound()
    throw error
  }
}
