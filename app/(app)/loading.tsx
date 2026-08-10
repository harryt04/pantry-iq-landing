import { Skeleton } from '@/components/ui/skeleton'

export default function AppLoading() {
  return (
    <main className="app-page app-page--loading" aria-busy="true">
      <Skeleton className="app-page__skeleton app-page__skeleton--eyebrow" />
      <Skeleton className="app-page__skeleton app-page__skeleton--heading" />
      <Skeleton className="app-page__skeleton app-page__skeleton--copy" />
      <Skeleton className="app-page__skeleton app-page__skeleton--card" />
    </main>
  )
}
