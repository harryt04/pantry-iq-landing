import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { RecipeBuilder } from '@/components/recipes/recipe-builder'
import { auth } from '@/src/server/auth/auth'

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/sign-in')
  const { locationId = '' } = await searchParams
  return <RecipeBuilder locationId={locationId} />
}
