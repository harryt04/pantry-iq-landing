import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/src/server/auth/auth'
import { getAccountResumeState } from '@/src/server/locations/locations'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { LocationManager } from '@/components/locations/location-manager'

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ entry?: string }>
}) {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session) redirect('/sign-in')

  const params = await searchParams
  if (params.entry === 'sign-in') {
    const preferredLocationId = (await cookies()).get(
      'pantryiq-location-id',
    )?.value
    const resume = await getAccountResumeState(
      requestHeaders,
      preferredLocationId,
    )
    if (resume.status === 'no-location') redirect('/welcome')
    if (resume.status === 'needs-import') {
      redirect(`/import?locationId=${encodeURIComponent(resume.locationId)}`)
    }
  }

  return (
    <main className="account-page account-page--locations">
      <header className="account-header">
        <div>
          <p className="auth-wordmark">PantryIQ</p>
          <p className="auth-eyebrow">Account</p>
          <h1 id="account-title">Manage your locations.</h1>
          <p>Keep each operation separate so every number has a clear home.</p>
        </div>
        <div className="account-header-actions">
          <p className="account-email">{session.user.email}</p>
          <SignOutButton />
        </div>
      </header>
      <LocationManager />
    </main>
  )
}
