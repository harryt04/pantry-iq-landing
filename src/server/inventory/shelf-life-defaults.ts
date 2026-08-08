export type ShelfLifeDefault = {
  category: string
  label: string
  days: number
}

/**
 * Reviewable starting points for new items. These are suggestions, not facts
 * measured in a particular kitchen; an item's explicit value always wins.
 */
export const SHELF_LIFE_DEFAULTS: readonly ShelfLifeDefault[] = [
  { category: 'seafood', label: 'Seafood', days: 3 },
  { category: 'proteins', label: 'Proteins', days: 3 },
  { category: 'produce', label: 'Produce', days: 5 },
  { category: 'dry goods', label: 'Dry goods', days: 30 },
  { category: 'pasta', label: 'Pasta', days: 30 },
  { category: 'salad', label: 'Salad', days: 2 },
  { category: 'soup', label: 'Soup', days: 3 },
  { category: 'beverages', label: 'Beverages', days: 30 },
  { category: 'spirits', label: 'Spirits', days: 180 },
  { category: 'beer', label: 'Beer', days: 30 },
  { category: 'wine', label: 'Wine', days: 30 },
  { category: 'mixers', label: 'Mixers', days: 14 },
  { category: 'coffee', label: 'Coffee', days: 30 },
  { category: 'citrus', label: 'Citrus', days: 5 },
  { category: 'herbs', label: 'Herbs', days: 5 },
  { category: 'garnish', label: 'Garnish', days: 3 },
]

export type ShelfLifeResolution =
  | {
      days: number
      source: 'user'
      suggestionCategory: null
    }
  | {
      days: number
      source: 'suggestion'
      suggestionCategory: string
    }
  | {
      days: null
      source: 'unset'
      suggestionCategory: null
    }

function normalizeCategory(category: string) {
  return category.trim().toLocaleLowerCase().replace(/[_-]+/g, ' ')
}

const CATEGORY_ALIASES: Readonly<Record<string, string>> = {
  beverage: 'beverages',
  protein: 'proteins',
}

export function getShelfLifeSuggestion(category: string | null) {
  if (!category) return null
  const normalized = normalizeCategory(category)
  const canonicalCategory = CATEGORY_ALIASES[normalized] ?? normalized
  return (
    SHELF_LIFE_DEFAULTS.find((entry) => entry.category === canonicalCategory) ??
    null
  )
}

export function resolveShelfLife({
  category,
  shelfLifeDays,
}: {
  category: string | null
  shelfLifeDays: number | null
}): ShelfLifeResolution {
  if (shelfLifeDays !== null) {
    return { days: shelfLifeDays, source: 'user', suggestionCategory: null }
  }

  const suggestion = getShelfLifeSuggestion(category)
  if (suggestion) {
    return {
      days: suggestion.days,
      source: 'suggestion',
      suggestionCategory: suggestion.category,
    }
  }

  return { days: null, source: 'unset', suggestionCategory: null }
}
