import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync(
  new URL('../app/(app)/settings/page.tsx', import.meta.url),
  'utf8',
)
const surface = readFileSync(
  new URL('../components/settings/item-master.tsx', import.meta.url),
  'utf8',
)
const listRoute = readFileSync(
  new URL('../app/api/items/route.ts', import.meta.url),
  'utf8',
)
const updateRoute = readFileSync(
  new URL('../app/api/items/[itemId]/route.ts', import.meta.url),
  'utf8',
)
const items = readFileSync(
  new URL('../src/server/inventory/items.ts', import.meta.url),
  'utf8',
)
const input = readFileSync(
  new URL('../src/server/inventory/item-input.ts', import.meta.url),
  'utf8',
)

describe('item master contract', () => {
  it('renders the selected location items in settings and keeps history explicit', () => {
    expect(page).toContain('<ItemMaster')
    expect(surface).toContain('Historical spoilage will not')
    expect(surface).toContain('Canonical name')
    expect(surface).toContain('PantryIQ default: not set')
    expect(surface).toContain('usageCount')
  })

  it('provides owner-scoped list and update routes', () => {
    expect(listRoute).toContain('listInventoryItems')
    expect(listRoute).toContain('includeInactive: true')
    expect(updateRoute).toContain('export async function PATCH')
    expect(updateRoute).toContain('updateInventoryItem')
    expect(items).toContain('requireOwnedLocation')
    expect(input).toContain('canonicalName cannot be changed')
    expect(items).toContain('updatedAt: new Date()')
    expect(items).toContain('enqueuePrecomputeForLocationInTransaction')
  })

  it('keeps the table usable at narrow widths and gives the active toggle a name', () => {
    expect(surface).toContain('item-master-table-wrap')
    expect(surface).toContain(
      "aria-label={`${item.isActive ? 'Archive' : 'Restore'} ${item.displayName}`}",
    )
    expect(surface).toContain('role="status"')
  })
})
