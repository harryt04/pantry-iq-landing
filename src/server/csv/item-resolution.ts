import type { CanonicalField } from './mapping'
import { getShelfLifeSuggestion } from '../inventory/shelf-life-defaults'

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
 * These are deliberately small, explicit rules. They remove modifiers a POS
 * commonly appends to a base item while leaving every other spelling alone.
 * A new rule requires a regression test because a false match corrupts all
 * downstream metrics.
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

/**
 * Case and whitespace are presentation differences, not fuzzy matching. The
 * resulting value is still compared for complete equality.
 */
export function normalizeExactItemName(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase()
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

  // A standalone item such as "Extra Sauce" must remain searchable. A
  // customization rule that removes the whole value therefore falls back to
  // the normalized original rather than producing an empty match key.
  return stripped || normalized
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

export type CsvItemResolutionRow = {
  rowNumber: number
  values: string[]
}

export type UnmatchedItemContext = {
  rowNumber: number
  values: Record<string, string>
}

export type UnmatchedItem = {
  rawItemName: string
  normalizedItemName: string
  reason: ItemResolutionMiss['reason']
  occurrenceCount: number
  rowNumbers: number[]
  context: UnmatchedItemContext[]
}

export type ResolvedCsvItemRow = {
  rowNumber: number
  rawItemName: string
  inventoryItemId: string
}

export type CsvItemResolution = {
  rawItemColumn: string | null
  matchedRows: ResolvedCsvItemRow[]
  unmatchedItems: UnmatchedItem[]
  canCommit: boolean
}

function rawItemColumnFor(
  columns: readonly string[],
  mapping: Readonly<Record<string, CanonicalField | null>>,
): string | null {
  return columns.find((column) => mapping[column] === 'rawItemName') ?? null
}

export function resolveCsvItems(input: {
  columns: readonly string[]
  mapping: Readonly<Record<string, CanonicalField | null>>
  rows: readonly CsvItemResolutionRow[]
  items: readonly ItemResolutionCandidate[]
}): CsvItemResolution {
  const rawItemColumn = rawItemColumnFor(input.columns, input.mapping)
  if (!rawItemColumn) {
    return {
      rawItemColumn: null,
      matchedRows: [],
      unmatchedItems: [],
      canCommit: false,
    }
  }

  const rawItemIndex = input.columns.indexOf(rawItemColumn)
  const matchedRows: ResolvedCsvItemRow[] = []
  const unmatchedByName = new Map<string, UnmatchedItem>()

  for (const row of input.rows) {
    const rawItemName = row.values[rawItemIndex] ?? ''
    const resolution = resolveExactItemName(rawItemName, input.items)
    if (resolution.status === 'matched') {
      matchedRows.push({
        rowNumber: row.rowNumber,
        rawItemName,
        inventoryItemId: resolution.item.id,
      })
      continue
    }

    const key = normalizeExactItemName(rawItemName) || `row-${row.rowNumber}`
    const existing = unmatchedByName.get(key)
    const context = Object.fromEntries(
      input.columns.map((column, index) => [column, row.values[index] ?? '']),
    )
    if (existing) {
      existing.occurrenceCount += 1
      existing.rowNumbers.push(row.rowNumber)
      if (existing.context.length < 5) {
        existing.context.push({ rowNumber: row.rowNumber, values: context })
      }
    } else {
      unmatchedByName.set(key, {
        rawItemName,
        normalizedItemName: resolution.normalizedItemName,
        reason: resolution.reason,
        occurrenceCount: 1,
        rowNumbers: [row.rowNumber],
        context: [{ rowNumber: row.rowNumber, values: context }],
      })
    }
  }

  return {
    rawItemColumn,
    matchedRows,
    unmatchedItems: [...unmatchedByName.values()],
    canCommit: unmatchedByName.size === 0,
  }
}

export function suggestedShelfLifeDays(category: string | null | undefined) {
  return getShelfLifeSuggestion(category ?? null)?.days ?? null
}

export class CsvItemResolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CsvItemResolutionError'
  }
}

export function assertCsvItemsResolved(resolution: CsvItemResolution) {
  if (!resolution.rawItemColumn) {
    throw new CsvItemResolutionError(
      'Map a CSV column to Item name before continuing.',
    )
  }
  if (!resolution.canCommit) {
    throw new CsvItemResolutionError(
      `${resolution.unmatchedItems.length} item name${resolution.unmatchedItems.length === 1 ? '' : 's'} still need${resolution.unmatchedItems.length === 1 ? 's' : ''} your decision before import can continue.`,
    )
  }
}
