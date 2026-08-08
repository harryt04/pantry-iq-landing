import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/src/server/auth/auth'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { LocationManager } from '@/components/locations/location-manager'

export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/sign-in')

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
