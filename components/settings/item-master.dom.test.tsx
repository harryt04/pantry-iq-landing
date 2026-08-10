import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ItemMaster, type ItemMasterItem } from './item-master'

/**
 * Replaces the component half of tests/shelf-life-defaults-contract.test.ts and
 * tests/item-master-contract.test.ts, which asserted the source contained
 * 'Suggested for' and 'list="pantryiq-item-categories"'.
 *
 * The rule worth protecting is that a suggested shelf life is never presented
 * as a value the user set. That is about what renders, not what is typed.
 */

const LOCATION_ID = 'location-1'
const fetchMock = vi.fn()

function item(overrides: Partial<ItemMasterItem> = {}): ItemMasterItem {
  return {
    id: 'item-1',
    canonicalName: 'salmon',
    displayName: 'Salmon',
    category: 'Seafood',
    unit: 'lb',
    itemType: 'ingredient',
    shelfLifeDays: null,
    effectiveShelfLifeDays: 3,
    shelfLifeSource: 'suggestion',
    shelfLifeSuggestionCategory: 'Seafood',
    costPerUnit: '9.50',
    usageCount: 12,
    isActive: true,
    updatedAt: '2026-08-08T00:00:00.000Z',
    ...overrides,
  } as ItemMasterItem
}

function rowFor(displayName: string) {
  return screen.getByRole('row', { name: new RegExp(displayName) })
}

describe('item master', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marks a suggested shelf life as a suggestion, naming its category', () => {
    render(<ItemMaster locationId={LOCATION_ID} initialItems={[item()]} />)

    const row = rowFor('Salmon')
    expect(within(row).getByText('Suggested for Seafood')).toBeInTheDocument()
    expect(within(row).getByText(/3 days/)).toBeInTheDocument()
  })

  it('distinguishes a value the user set from a suggestion', () => {
    render(
      <ItemMaster
        locationId={LOCATION_ID}
        initialItems={[
          item({
            shelfLifeDays: 5,
            effectiveShelfLifeDays: 5,
            shelfLifeSource: 'user',
          }),
        ]}
      />,
    )

    const row = rowFor('Salmon')
    expect(row.textContent).toContain('Your value')
    expect(row.textContent).not.toContain('Suggested for')
  })

  it('says plainly when no shelf life is available at all', () => {
    render(
      <ItemMaster
        locationId={LOCATION_ID}
        initialItems={[
          item({
            effectiveShelfLifeDays: null,
            shelfLifeSource: 'unset',
            shelfLifeSuggestionCategory: null,
          }),
        ]}
      />,
    )

    const row = rowFor('Salmon')
    expect(within(row).getByText('No suggestion available')).toBeInTheDocument()
    // An unknown shelf life must not render as a confident zero.
    expect(within(row).queryByText(/0 days/)).not.toBeInTheDocument()
  })

  it('offers categories as suggestions without closing the field to new ones', async () => {
    const { container } = render(
      <ItemMaster locationId={LOCATION_ID} initialItems={[item()]} />,
    )

    await userEvent.click(screen.getByRole('button', { name: /Edit/ }))

    const categoryInput = await screen.findByLabelText('Category for Salmon')
    expect(categoryInput).toHaveAttribute('list', 'pantryiq-item-categories')
    // A datalist suggests; a select would forbid. Categories must stay open.
    expect(container.querySelector('#pantryiq-item-categories')).toBeTruthy()
    expect(categoryInput.tagName).toBe('INPUT')
  })

  it('sends an edit to the owner-scoped item endpoint', async () => {
    render(<ItemMaster locationId={LOCATION_ID} initialItems={[item()]} />)

    await userEvent.click(screen.getByRole('button', { name: /Edit/ }))
    const shelfLifeInput = await screen.findByLabelText(
      'Shelf life in days for Salmon',
    )
    await userEvent.clear(shelfLifeInput)
    await userEvent.type(shelfLifeInput, '5')
    await userEvent.click(screen.getByRole('button', { name: /^Save/ }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/items/item-1')
    expect(url).toContain(`locationId=${LOCATION_ID}`)
    expect(init.method).toBe('PATCH')
  })

  it('shows an empty state rather than an empty table', () => {
    render(<ItemMaster locationId={LOCATION_ID} initialItems={[]} />)

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
