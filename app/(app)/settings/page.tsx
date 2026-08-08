import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { AccountSettings } from '@/components/settings/account-settings'
import { auth } from '@/src/server/auth/auth'

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/sign-in')

  return (
    <main className="app-page" aria-labelledby="settings-title">
      <p className="app-page__eyebrow">Settings</p>
      <h1 id="settings-title">Account settings.</h1>
      <p className="app-page__lede">
        Keep your account details current. Location assumptions and item
        settings will live here as they become available.
      </p>
      <AccountSettings
        initialCompanyName={session.user.companyName ?? ''}
        initialEmail={session.user.email}
        initialName={session.user.name}
      />
    </main>
  )
}
