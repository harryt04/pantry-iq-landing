import { describe, expect, it } from 'vitest'

import {
  assertCsvItemsResolved,
  CsvItemResolutionError,
  resolveCsvItems,
  resolveExactItemName,
  stripKnownCustomizations,
  suggestedShelfLifeDays,
} from './item-resolution'

const lobster = {
  id: '11111111-1111-4111-8111-111111111111',
  canonicalName: 'lobster pasta',
  displayName: 'Lobster Pasta',
  category: 'seafood',
  unit: 'each',
}

const salad = {
  id: '22222222-2222-4222-8222-222222222222',
  canonicalName: 'caesar salad',
  displayName: 'Caesar Salad',
  category: 'salad',
  unit: 'each',
}

describe('CSV item name resolution', () => {
  it('strips only the documented customization clauses', () => {
    expect(stripKnownCustomizations('Lobster Pasta, no tomatoes')).toBe(
      'lobster pasta',
    )
    expect(stripKnownCustomizations('Lobster Pasta (extra sauce)')).toBe(
      'lobster pasta',
    )
    expect(stripKnownCustomizations('Lobster Pasta - substitute fries')).toBe(
      'lobster pasta',
    )
    expect(stripKnownCustomizations('Lobster Pasta with tomato')).toBe(
      'lobster pasta with tomato',
    )
  })

  it('links normalized exact matches and never fuzzy matches', () => {
    expect(resolveExactItemName('Lobster Pasta', [lobster])).toMatchObject({
      status: 'matched',
      item: lobster,
    })
    expect(resolveExactItemName('Lobster Past', [lobster])).toMatchObject({
      status: 'unmatched',
      reason: 'no-exact-match',
    })
    expect(
      resolveExactItemName('Lobster Pasta, no tomatoes', [lobster]),
    ).toMatchObject({ status: 'matched', item: lobster })
  })

  it('links deterministic last-first labels without introducing fuzzy matching', () => {
    expect(
      resolveExactItemName('Fillet, salmon', [
        { ...lobster, canonicalName: 'salmon fillet' },
      ]),
    ).toMatchObject({
      status: 'matched',
      item: { canonicalName: 'salmon fillet' },
    })
    expect(
      resolveExactItemName('Fillet, salmon, special', [
        { ...lobster, canonicalName: 'salmon fillet' },
      ]),
    ).toMatchObject({
      status: 'unmatched',
      reason: 'no-exact-match',
    })
  })

  it('does not use inactive or ambiguous items as an automatic link', () => {
    expect(
      resolveExactItemName('Caesar Salad', [{ ...salad, isActive: false }]),
    ).toMatchObject({ status: 'unmatched', reason: 'no-exact-match' })
    expect(
      resolveExactItemName('Caesar Salad', [
        salad,
        { ...salad, id: lobster.id },
      ]),
    ).toMatchObject({ status: 'unmatched', reason: 'ambiguous-match' })
  })

  it('groups repeated unresolved names but caps context examples at five', () => {
    const resolution = resolveCsvItems({
      columns: ['Item', 'Quantity'],
      mapping: { Item: 'rawItemName', Quantity: 'qty' },
      rows: Array.from({ length: 6 }, (_, index) => ({
        rowNumber: index + 2,
        values: ['Unknown Soup', String(index + 1)],
      })),
      items: [lobster],
    })

    expect(resolution).toMatchObject({
      rawItemColumn: 'Item',
      matchedRows: [],
      canCommit: false,
    })
    expect(resolution.unmatchedItems).toHaveLength(1)
    expect(resolution.unmatchedItems[0]).toMatchObject({
      rawItemName: 'Unknown Soup',
      occurrenceCount: 6,
      rowNumbers: [2, 3, 4, 5, 6, 7],
    })
    expect(resolution.unmatchedItems[0]?.context).toHaveLength(5)
  })

  it('preserves raw names while resolving rows and allows import only when complete', () => {
    const resolution = resolveCsvItems({
      columns: ['Item', 'Quantity'],
      mapping: { Item: 'rawItemName', Quantity: 'qty' },
      rows: [
        { rowNumber: 2, values: ['Lobster Pasta, no tomatoes', '1'] },
        { rowNumber: 3, values: ['Caesar Salad', '2'] },
      ],
      items: [lobster, salad],
    })

    expect(resolution.matchedRows).toEqual([
      {
        rowNumber: 2,
        rawItemName: 'Lobster Pasta, no tomatoes',
        inventoryItemId: lobster.id,
      },
      {
        rowNumber: 3,
        rawItemName: 'Caesar Salad',
        inventoryItemId: salad.id,
      },
    ])
    expect(() => assertCsvItemsResolved(resolution)).not.toThrow()
  })

  it('blocks continuation while any item is unresolved', () => {
    const resolution = resolveCsvItems({
      columns: ['Item'],
      mapping: { Item: 'rawItemName' },
      rows: [{ rowNumber: 2, values: ['New Item'] }],
      items: [],
    })

    expect(() => assertCsvItemsResolved(resolution)).toThrow(
      CsvItemResolutionError,
    )
    expect(() => assertCsvItemsResolved(resolution)).toThrow(
      'still needs your decision',
    )
  })

  it('labels shelf-life values as editable suggestions from the committed lookup', () => {
    expect(suggestedShelfLifeDays('Seafood')).toBe(3)
    expect(suggestedShelfLifeDays('pasta')).toBe(30)
    expect(suggestedShelfLifeDays('seasonal special')).toBeNull()
  })
})
