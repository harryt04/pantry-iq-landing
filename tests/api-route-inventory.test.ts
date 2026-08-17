import { readdirSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * A structural guard, not a behavioral test. It enumerates the real route tree
 * so a new endpoint cannot appear without a deliberate edit here, which is the
 * moment to ask whether the route needs owner scoping and a route test.
 *
 * Whether each route actually enforces ownership is proved by the request
 * tests in tests/api/ and by tests/integration/ownership-boundary.test.ts.
 * This file only proves the inventory is complete.
 */

const apiRoot = path.resolve(new URL('../app/api/', import.meta.url).pathname)

function routeFiles(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(prefix, entry.name)
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return routeFiles(absolute, relative)
    return entry.name === 'route.ts' ? [relative] : []
  })
}

const ownerScopedRoutes = [
  'chat/misses/route.ts',
  'chat/override/route.ts',
  'chat/route.ts',
  'connectors/status/route.ts',
  'exports/[exportType]/route.ts',
  'items/[itemId]/route.ts',
  'items/route.ts',
  'locations/[locationId]/route.ts',
  'locations/route.ts',
  'manual-entry/route.ts',
  'observability/route.ts',
  'recipes/route.ts',
  'reconciliation/route.ts',
  'uploads/[uploadId]/commit/route.ts',
  'uploads/[uploadId]/mapping/route.ts',
  'uploads/[uploadId]/preview/route.ts',
  'uploads/[uploadId]/type/route.ts',
  'uploads/history/route.ts',
  'uploads/route.ts',
] as const

const publicRoutes = ['auth/[...all]/route.ts', 'health/route.ts'] as const

describe('API route inventory', () => {
  it('accounts for every route file as owner-scoped or deliberately public', () => {
    const actual = routeFiles(apiRoot).sort()
    const expected = [...ownerScopedRoutes, ...publicRoutes].sort()

    expect(actual).toEqual(expected)
  })

  it('keeps the public surface to authentication and health only', () => {
    expect([...publicRoutes]).toEqual([
      'auth/[...all]/route.ts',
      'health/route.ts',
    ])
  })
})
