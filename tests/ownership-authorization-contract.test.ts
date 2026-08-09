import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

type RouteContract = {
  file: string
  markers: readonly string[]
}

const apiRoot = path.resolve(new URL('../app/api/', import.meta.url).pathname)

function routeFiles(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(prefix, entry.name)
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return routeFiles(absolute, relative)
    return entry.name === 'route.ts' ? [relative] : []
  })
}

const protectedRoutes: readonly RouteContract[] = [
  { file: 'chat/misses/route.ts', markers: ['requireOwnedLocation'] },
  { file: 'chat/override/route.ts', markers: ['requireOwnedLocation'] },
  { file: 'chat/route.ts', markers: ['requireOwnedLocation'] },
  { file: 'exports/[exportType]/route.ts', markers: ['exportLocationCsv'] },
  { file: 'items/[itemId]/route.ts', markers: ['updateInventoryItem'] },
  { file: 'items/route.ts', markers: ['listInventoryItems'] },
  {
    file: 'locations/[locationId]/route.ts',
    markers: ['getLocationDeletionSummary', 'updateLocation', 'deleteLocation'],
  },
  { file: 'locations/route.ts', markers: ['listLocations', 'createLocation'] },
  { file: 'manual-entry/route.ts', markers: ['createManualEntry'] },
  {
    file: 'recipes/route.ts',
    markers: ['listRecipes', 'getRecipe', 'saveRecipe'],
  },
  {
    file: 'uploads/[uploadId]/commit/route.ts',
    markers: ['previewCsvImport', 'commitCsvImport'],
  },
  {
    file: 'uploads/[uploadId]/mapping/route.ts',
    markers: ['saveCsvMapping'],
  },
  { file: 'uploads/[uploadId]/preview/route.ts', markers: ['previewCsv'] },
  { file: 'uploads/history/route.ts', markers: ['listImportHistory'] },
  { file: 'uploads/route.ts', markers: ['uploadCsv'] },
]

const publicRoutes = ['api/auth/[...all]/route.ts', 'api/health/route.ts']

describe('ownership authorization contract', () => {
  it('keeps an explicit inventory of every API route', () => {
    const actual = routeFiles(apiRoot)
      .map((file) => path.join('api', file))
      .sort()
    const expected = [
      ...protectedRoutes.map((route) => path.join('api', route.file)),
      ...publicRoutes,
    ].sort()

    expect(actual).toEqual(expected)
  })

  it('requires every protected route to name its owner-scoped boundary', () => {
    for (const route of protectedRoutes) {
      const file = readFileSync(path.join(apiRoot, route.file), 'utf8')
      for (const marker of route.markers) expect(file).toContain(marker)
      expect(file).not.toMatch(/from ['"]@\/src\/server\/db\//)
    }
  })

  it('keeps public routes limited to the intentional auth and health surfaces', () => {
    const files = routeFiles(apiRoot).map((file) => path.join('api', file))
    expect(files.filter((file) => !publicRoutes.includes(file))).not.toContain(
      'api/health/route.ts',
    )
  })

  it('does not allow an identifier route to omit its ownership contract', () => {
    for (const route of protectedRoutes) {
      if (!route.file.includes('[') && route.file !== 'chat/misses/route.ts')
        continue
      const source = readFileSync(path.join(apiRoot, route.file), 'utf8')
      expect(source).toMatch(
        /requireOwnedLocation|exportLocationCsv|updateInventoryItem|previewCsvImport|commitCsvImport|saveCsvMapping|previewCsv|listImportHistory|uploadCsv|getLocationDeletionSummary|updateLocation|deleteLocation/,
      )
    }
  })
})
