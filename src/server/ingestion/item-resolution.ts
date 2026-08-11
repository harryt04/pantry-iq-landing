export type ItemResolutionCandidate = {
  id: string
  canonicalName: string
  displayName: string
  category: string | null
  unit: string
  isActive?: boolean
}

export type ItemResolutionMatch = {
  status: 'matched'
  rawItemName: string
  normalizedItemName: string
  item: ItemResolutionCandidate
}

export type ItemResolutionMiss = {
  status: 'unmatched'
  rawItemName: string
  normalizedItemName: string
  reason: 'empty-name' | 'no-exact-match' | 'ambiguous-match'
}

export type ItemResolution = ItemResolutionMatch | ItemResolutionMiss

/**
 * Exact resolution is shared by every source. These are presentation-only
 * normalizations, not fuzzy matching: the resulting name must still equal a
 * canonical name in full.
 */
export const ITEM_CUSTOMIZATION_RULES = [
  {
    name: 'modifier clause',
    pattern:
      /\b(?:no|without|w\/?o|extra|add(?:ed)?|light|hold|remove|minus|sub(?:stitute)?)\s+[^,;|()[\]{}]+/giu,
  },
  {
    name: 'on-the-side clause',
    pattern: /\bon\s+the\s+side\b/giu,
  },
] as const

export function normalizeExactItemName(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase()
}

/**
 * Some POS exports render a two-part item label as "last, first". Reordering
 * exactly two comma-separated parts is a deterministic presentation
 * normalization; it is still an exact match after the normalization step.
 */
function normalizeLastFirstPresentation(value: string): string {
  const parts = value.split(',')
  if (parts.length !== 2) return value

  const [last, first] = parts.map((part) => part.trim())
  if (!last || !first) return value
  return `${first} ${last}`
}

export function stripKnownCustomizations(value: string): string {
  const normalized = normalizeExactItemName(value)
  let stripped = normalized

  for (const rule of ITEM_CUSTOMIZATION_RULES) {
    stripped = stripped.replace(
      new RegExp(rule.pattern.source, rule.pattern.flags),
      '',
    )
  }

  stripped = stripped
    .replace(/[([{]\s*[)\]}]/gu, '')
    .replace(/\s*[,;|]\s*(?=$|[,;|])/gu, '')
    .replace(/(?:\s*[-–—:]\s*)+$/gu, '')
    .replace(/^[,;|]+/gu, '')
    .trim()

  return normalizeLastFirstPresentation(stripped || normalized)
}

export function resolveExactItemName(
  rawItemName: string,
  items: readonly ItemResolutionCandidate[],
): ItemResolution {
  const normalizedItemName = stripKnownCustomizations(rawItemName)
  if (!normalizedItemName) {
    return {
      status: 'unmatched',
      rawItemName,
      normalizedItemName,
      reason: 'empty-name',
    }
  }

  const matches = items.filter(
    (item) =>
      item.isActive !== false &&
      normalizeExactItemName(item.canonicalName) === normalizedItemName,
  )

  if (matches.length === 1) {
    return {
      status: 'matched',
      rawItemName,
      normalizedItemName,
      item: matches[0]!,
    }
  }

  return {
    status: 'unmatched',
    rawItemName,
    normalizedItemName,
    reason: matches.length > 1 ? 'ambiguous-match' : 'no-exact-match',
  }
}
