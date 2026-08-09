import { getAppShellData } from '@/components/app/app-shell-server'
import { getDashboardRecommendations } from '@/src/server/metrics/dashboard-recommendations'
import { headers } from 'next/headers'

import { ChatSurface } from '@/components/chat/chat-surface'

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string | string[] }>
}) {
  const [{ locations, initialLocationId }, params] = await Promise.all([
    getAppShellData(),
    searchParams,
  ])
  const requestedLocationId = Array.isArray(params.locationId)
    ? params.locationId[0]
    : params.locationId
  const location =
    locations.find((candidate) => candidate.id === requestedLocationId) ??
    locations.find((candidate) => candidate.id === initialLocationId) ??
    locations[0]

  if (!location) {
    return null
  }

  const recommendations = await getDashboardRecommendations(
    await headers(),
    location.id,
  )

  return (
    <main className="app-page chat-page" aria-labelledby="chat-title">
      <p className="app-page__eyebrow">Chat</p>
      <h1 id="chat-title">Ask about this location.</h1>
      <p className="app-page__lede">
        Ask a focused question and keep the conversation grounded in one
        location at a time.
      </p>
      <ChatSurface
        key={location.id}
        locationId={location.id}
        locationName={location.name}
        recommendations={recommendations}
      />
    </main>
  )
}
