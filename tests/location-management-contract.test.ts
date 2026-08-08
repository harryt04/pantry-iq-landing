import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const surface = readFileSync(
  new URL('../components/locations/location-manager.tsx', import.meta.url),
  'utf8',
)
const service = readFileSync(
  new URL('../src/server/locations/locations.ts', import.meta.url),
  'utf8',
)
const route = readFileSync(
  new URL('../app/api/locations/[locationId]/route.ts', import.meta.url),
  'utf8',
)
const shell = readFileSync(
  new URL('../components/app/app-shell.tsx', import.meta.url),
  'utf8',
)
const settings = readFileSync(
  new URL('../app/(app)/settings/page.tsx', import.meta.url),
  'utf8',
)

describe('location management contract', () => {
  it('lists location destinations and mounts the manager in settings', () => {
    expect(surface).toContain('View dashboard')
    expect(surface).toContain('View chat')
    expect(settings).toContain('<LocationManager />')
  })

  it('requires actual deletion counts before destructive confirmation', () => {
    expect(surface).toContain('Loading the data that will be removed')
    expect(surface).toContain(
      'This deletes {deletionSummary.importCount} import',
    )
    expect(surface).toContain('can&apos;t be undone.')
    expect(route).toContain('export async function GET')
    expect(route).toContain('getLocationDeletionSummary')
  })

  it('removes location-owned records in one database transaction', () => {
    expect(route).toContain('export async function DELETE')
    expect(service).toContain('await db.transaction')
    for (const table of [
      'inventorySnapshots',
      'transactions',
      'purchaseOrderItems',
      'purchaseOrders',
      'csvUploadHistory',
      'recipes',
      'inventoryItems',
      'locations',
    ]) {
      expect(service).toContain(`.delete(${table})`)
    }
  })

  it('falls back to a remaining location when the current one disappears', () => {
    expect(surface).toContain('router.refresh()')
    expect(shell).toContain('const fallbackLocation = locations[0]')
    expect(shell).toContain('rememberLocation(fallbackLocation.id)')
  })
})
