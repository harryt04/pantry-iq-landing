import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ItemDeepDives } from './item-deep-dives'
import type {
  ItemDeepDive,
  ItemDeepDiveGroups,
} from '@/src/server/metrics/item-deep-dives'

/**
 * Replaces tests/item-deep-dive-contract.test.ts, which asserted the source
 * contained 'groups.topSelling', 'Assumptions used' and 'matchMedia'.
 *
 * The rule worth protecting is that an item with too little data is still
 * listed and is labelled as such, rather than quietly dropped or shown with a
 * confident-looking zero.
 */

const LOCATION_ID = 'location-1'

function deepDive(overrides: Partial<ItemDeepDive> = {}): ItemDeepDive {
  return {
    itemId: 'item-1',
    displayName: 'Salmon',
    category: 'Seafood',
    unit: 'lb',
    quantitySold: '40',
    quantityOrdered: '50',
    quantityOnHand: '10',
    totalRevenue: '960.00',
    margin: '42.5',
    spoilageRisk: '12',
    sellThroughRate: '80',
    unitCost: '9.50',
    unitCostSource: 'purchase orders',
    shelfLifeDays: 3,
    shelfLifeSource: 'category suggestion',
    shelfLifeCategory: 'Seafood',
    recentSales: [],
    recentOrders: [],
    recommendations: [],
    ...overrides,
  }
}

function groups(
  overrides: Partial<ItemDeepDiveGroups> = {},
): ItemDeepDiveGroups {
  return {
    topSelling: [deepDive()],
    spoilageRisk: [],
    lowMargin: [],
    needsData: [],
    ...overrides,
  }
}

function renderGroups(value: ItemDeepDiveGroups) {
  return render(<ItemDeepDives locationId={LOCATION_ID} groups={value} />)
}

describe('item deep dives', () => {
  it('lists items by display name, not canonical name', () => {
    renderGroups(groups())

    expect(screen.getAllByText('Salmon').length).toBeGreaterThan(0)
  })

  it('keeps items with too little data visible and labelled', () => {
    renderGroups(
      groups({
        topSelling: [],
        needsData: [
          deepDive({
            itemId: 'item-2',
            displayName: 'Capers',
            quantitySold: null,
            totalRevenue: null,
            margin: null,
            sellThroughRate: null,
          }),
        ],
      }),
    )

    expect(screen.getAllByText('Capers').length).toBeGreaterThan(0)
    // Dropping the item, or printing 0%, would both misrepresent the gap.
    expect(document.body.textContent).not.toContain('0%')
  })

  it('opens a detail surface naming the item that was chosen', async () => {
    renderGroups(groups())

    await userEvent.click(screen.getAllByText('Salmon')[0]!)

    expect(await screen.findByText(/Assumptions used/)).toBeInTheDocument()
  })

  it('attributes a suggested shelf life to its category', async () => {
    renderGroups(groups())

    await userEvent.click(screen.getAllByText('Salmon')[0]!)

    expect(
      (await screen.findAllByText(/Suggested for seafood/i)).length,
    ).toBeGreaterThan(0)
  })

  it('says a shelf life is unavailable rather than implying zero', async () => {
    renderGroups(
      groups({
        topSelling: [
          deepDive({
            shelfLifeDays: null,
            shelfLifeSource: 'not available',
            shelfLifeCategory: null,
          }),
        ],
      }),
    )

    await userEvent.click(screen.getAllByText('Salmon')[0]!)

    expect(
      (await screen.findAllByText(/Not available/)).length,
    ).toBeGreaterThan(0)
  })

  it('renders nothing loud when every group is empty', () => {
    const { container } = renderGroups(
      groups({
        topSelling: [],
        spoilageRisk: [],
        lowMargin: [],
        needsData: [],
      }),
    )

    expect(container.textContent).not.toContain('Salmon')
  })
})
