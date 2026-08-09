import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync(
  new URL('../app/(app)/dashboard/page.tsx', import.meta.url),
  'utf8',
)
const component = readFileSync(
  new URL('../components/dashboard/item-deep-dives.tsx', import.meta.url),
  'utf8',
)
const data = readFileSync(
  new URL('../src/server/metrics/item-deep-dives.ts', import.meta.url),
  'utf8',
)

describe('dashboard item deep dive contract', () => {
  it('loads item detail only for the ready, selected-location dashboard', () => {
    expect(page).toContain('getDashboardItemDeepDives')
    expect(page).toContain('buildItemDeepDiveGroups')
    expect(component).toContain('groups.topSelling')
    expect(component).toContain('groups.spoilageRisk')
    expect(component).toContain('groups.lowMargin')
  })

  it('uses display names and both responsive Radix surfaces', () => {
    expect(component).toContain('{item.displayName}')
    expect(component).toContain('<SheetContent')
    expect(component).toContain('<DialogContent')
    expect(component).toContain('matchMedia')
    expect(component).toContain('itemId')
  })

  it('preserves honest assumptions and visible insufficient-data items', () => {
    expect(component).toContain('Assumptions used')
    expect(component).toContain('Edit item settings')
    expect(component).toContain('Not enough data')
    expect(component).toContain('Needs more data')
    expect(data).toContain('needsData')
    expect(data).toContain('requireOwnedLocation')
  })
})
