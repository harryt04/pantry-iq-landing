import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { AccountSettings } from '@/components/settings/account-settings'
import { ItemMaster } from '@/components/settings/item-master'
import { LocationManager } from '@/components/locations/location-manager'
import { auth } from '@/src/server/auth/auth'
import { listInventoryItems } from '@/src/server/inventory/items'
import { listLocations } from '@/src/server/locations/locations'
import { resolveShelfLife } from '@/src/server/inventory/shelf-life-defaults'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>
}) {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/sign-in')

  const locations = (await listLocations(requestHeaders)).filter(
    (location) => location.isActive,
  )
  const requestedLocationId = (await searchParams).locationId
  const selectedLocation =
    locations.find((location) => location.id === requestedLocationId) ??
    locations[0]
  const rawItems = selectedLocation
    ? await listInventoryItems(requestHeaders, selectedLocation.id, {
        includeInactive: true,
      })
    : []
  const items = rawItems.map((item) => {
    const shelfLife = resolveShelfLife(item)
    return {
      ...item,
      effectiveShelfLifeDays: shelfLife.days,
      shelfLifeSource: shelfLife.source,
      shelfLifeSuggestionCategory: shelfLife.suggestionCategory,
    }
  })

  return (
    <main className="app-page" aria-labelledby="settings-title">
      <p className="app-page__eyebrow">Settings</p>
      <h1 id="settings-title">Account settings.</h1>
      <p className="app-page__lede">
        Keep your account details and location assumptions current. Changes stay
        scoped to the selected operation.
      </p>
      <AccountSettings
        initialCompanyName={session.user.companyName ?? ''}
        initialEmail={session.user.email}
        initialName={session.user.name}
      />
      <LocationManager />
      {selectedLocation ? (
        <ItemMaster initialItems={items} locationId={selectedLocation.id} />
      ) : null}
    </main>
  )
}
