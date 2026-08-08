import { describe, expect, it } from 'vitest'

import {
  fullYearLocationFixture,
  messyCsvFixture,
  partialDataLocationFixture,
} from './pantry'

describe('shared PantryIQ fixtures', () => {
  it('keeps the messy CSV useful for parser edge cases', () => {
    expect(messyCsvFixture).toContain('\uFEFF')
    expect(messyCsvFixture).toContain('"Soup, tomato"')
    expect(messyCsvFixture.split('\n')).toContain('')
  })

  it('models a location below the four-week prediction threshold', () => {
    expect(partialDataLocationFixture.sales).toHaveLength(14)
    expect(partialDataLocationFixture.inventorySnapshots).toEqual([])
    expect(
      new Date(
        partialDataLocationFixture.sales.at(-1)?.transactedAt ?? '',
      ).getTime() -
        new Date(
          partialDataLocationFixture.sales[0]?.transactedAt ?? '',
        ).getTime(),
    ).toBe(13 * 24 * 60 * 60 * 1000)
  })

  it('provides a stable full-year fixture with ordered, unique records', () => {
    const { sales, inventorySnapshots } = fullYearLocationFixture

    expect(sales).toHaveLength(365)
    expect(inventorySnapshots).toHaveLength(52)
    expect(sales[0]?.transactedAt).toBe('2025-01-01T12:00:00.000Z')
    expect(sales.at(-1)?.transactedAt).toBe('2025-12-31T12:00:00.000Z')
    expect(new Set(sales.map(({ externalId }) => externalId)).size).toBe(365)
    expect(
      new Set(inventorySnapshots.map(({ externalId }) => externalId)).size,
    ).toBe(52)
  })
})
