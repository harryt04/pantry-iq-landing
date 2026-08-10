import { cookies, headers } from 'next/headers'

import { LaborEfficiencyView } from '@/components/staffing/labor-efficiency-view'
import { getAppShellData } from '@/components/app/app-shell-server'
import { getLaborEfficiency } from '@/src/server/staffing/labor-efficiency-query'

export default async function StaffingPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>
}) {
  const params = await searchParams
  const { initialLocationId } = await getAppShellData()
  const locationId =
    params.locationId ??
    (await cookies()).get('pantryiq-location-id')?.value ??
    initialLocationId
  const result = await getLaborEfficiency(await headers(), locationId)

  return <LaborEfficiencyView result={result} />
}
