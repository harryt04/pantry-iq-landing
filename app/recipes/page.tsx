import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { getAppShellData } from '@/components/app/app-shell-server'
import { RecipeBuilder } from '@/components/recipes/recipe-builder'
import { auth } from '@/src/server/auth/auth'

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/sign-in')
  const shellData = await getAppShellData()
  const requestedLocationId = (await searchParams).locationId
  const locationId = shellData.locations.some(
    (location) => location.id === requestedLocationId,
  )
    ? requestedLocationId!
    : shellData.initialLocationId

  return (
    <AppShell {...shellData} initialLocationId={locationId}>
      <RecipeBuilder locationId={locationId} />
    </AppShell>
  )
}
