import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { MenuEngineeringView } from '@/components/menu-engineering/menu-engineering-view'
import { auth } from '@/src/server/auth/auth'
import { getMenuEngineering } from '@/src/server/menu/menu-engineering-query'

export default async function MenuEngineeringPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>
}) {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session) redirect('/sign-in')

  const { locationId = '' } = await searchParams
  if (!locationId) {
    return (
      <main className="menu-engineering-page">
        <p>Select a location before opening menu engineering.</p>
      </main>
    )
  }

  const result = await getMenuEngineering(requestHeaders, locationId)
  return <MenuEngineeringView result={result} />
}
