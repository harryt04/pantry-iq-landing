import { describe, expect, it } from 'vitest'

import {
  getShelfLifeSuggestion,
  resolveShelfLife,
  SHELF_LIFE_DEFAULTS,
} from './shelf-life-defaults'

describe('shelf-life defaults', () => {
  it('keeps a reviewable category list with the documented seafood and dry-good suggestions', () => {
    expect(SHELF_LIFE_DEFAULTS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'seafood', days: 3 }),
        expect.objectContaining({ category: 'dry goods', days: 30 }),
      ]),
    )
  })

  it('matches common category separators without changing free-text categories', () => {
    expect(getShelfLifeSuggestion('Dry_goods')?.days).toBe(30)
    expect(getShelfLifeSuggestion('custom house blend')).toBeNull()
  })

  it('always prefers the explicit item value over a category suggestion', () => {
    expect(resolveShelfLife({ category: 'seafood', shelfLifeDays: 7 })).toEqual(
      { days: 7, source: 'user', suggestionCategory: null },
    )
  })

  it('returns a labelled suggestion when no item override exists', () => {
    expect(
      resolveShelfLife({ category: 'seafood', shelfLifeDays: null }),
    ).toEqual({ days: 3, source: 'suggestion', suggestionCategory: 'seafood' })
  })

  it('keeps unknown or uncategorised items explicitly unset', () => {
    expect(resolveShelfLife({ category: null, shelfLifeDays: null })).toEqual({
      days: null,
      source: 'unset',
      suggestionCategory: null,
    })
  })
})
