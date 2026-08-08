import Link from 'next/link'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>
}) {
  const { locationId = '' } = await searchParams

  return (
    <main className="app-page" aria-labelledby="dashboard-title">
      <p className="app-page__eyebrow">Dashboard</p>
      <h1 id="dashboard-title">Start with the data you already have.</h1>
      <p className="app-page__lede">
        Import a sales, purchasing, or inventory CSV for this location. The
        dashboard will show what the data can support once it has been checked.
      </p>
      <Link
        className="app-page__primary-action"
        href={`/import?locationId=${encodeURIComponent(locationId)}`}
      >
        Import data
      </Link>
    </main>
  )
}
