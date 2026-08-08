import Link from 'next/link'

export default function SettingsPage() {
  return (
    <main className="app-page" aria-labelledby="settings-title">
      <p className="app-page__eyebrow">Settings</p>
      <h1 id="settings-title">
        Keep this location&apos;s assumptions visible.
      </h1>
      <p className="app-page__lede">
        Location details and item settings will live here. Account-level
        location management is available now.
      </p>
      <Link className="app-page__secondary-action" href="/account">
        Manage locations
      </Link>
    </main>
  )
}
