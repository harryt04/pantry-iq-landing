import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { SignOutButton } from '@/components/auth/sign-out-button'
import { FirstLocationForm } from '@/components/locations/first-location-form'
import { auth } from '@/src/server/auth/auth'

export default async function WelcomePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/sign-in')

  return (
    <main className="account-page first-session-page">
      <section
        className="account-card first-session-card"
        aria-labelledby="welcome-title"
      >
        <div className="first-session-card__header">
          <div>
            <p className="auth-wordmark">PantryIQ</p>
            <p className="auth-eyebrow">First session</p>
          </div>
          <SignOutButton />
        </div>
        <div className="first-session-card__copy">
          <h1 id="welcome-title">Start with one location.</h1>
          <p>
            Name the location whose data you want to understand first. You can
            add more locations later.
          </p>
        </div>
        <FirstLocationForm />
      </section>
    </main>
  )
}
