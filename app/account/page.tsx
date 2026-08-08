import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/src/server/auth/auth'
import { SignOutButton } from '@/components/auth/sign-out-button'

export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/sign-in')

  return (
    <main className="account-page">
      <section className="account-card" aria-labelledby="account-title">
        <p className="auth-wordmark">PantryIQ</p>
        <p className="auth-eyebrow">Account</p>
        <h1 id="account-title">You’re signed in.</h1>
        <p>
          This owner account is ready for the next step: adding a location and
          bringing in your first data.
        </p>
        <p className="account-email">{session.user.email}</p>
        <SignOutButton />
      </section>
    </main>
  )
}
