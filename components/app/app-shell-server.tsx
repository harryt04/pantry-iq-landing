import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/src/server/auth/auth'
import { listLocations } from '@/src/server/locations/locations'

import { AppShell, type AppShellLocation } from './app-shell'

export type AppShellData = {
  locations: AppShellLocation[]
  initialLocationId: string
}

export async function getAppShellData(): Promise<AppShellData> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session) redirect('/sign-in')

  const allLocations = await listLocations(requestHeaders)
  const locations = allLocations
    .filter((location) => location.isActive)
    .map(({ id, name }) => ({ id, name }))

  if (locations.length === 0) redirect('/account')

  const storedLocationId = (await cookies()).get('pantryiq-location-id')?.value
  const initialLocationId = locations.some(
    (location) => location.id === storedLocationId,
  )
    ? storedLocationId!
    : locations[0]!.id

  return { locations, initialLocationId }
}

export async function AppShellRoute({
  children,
  initialLocationId,
}: {
  children: React.ReactNode
  initialLocationId?: string
}) {
  const shellData = await getAppShellData()
  return (
    <AppShell
      {...shellData}
      initialLocationId={initialLocationId ?? shellData.initialLocationId}
    >
      {children}
    </AppShell>
  )
}
