import type { CanonicalField } from './mapping'
import { getShelfLifeSuggestion } from '../inventory/shelf-life-defaults'
export {
  ITEM_CUSTOMIZATION_RULES,
  normalizeExactItemName,
  resolveExactItemName,
  stripKnownCustomizations,
  type ItemResolution,
  type ItemResolutionCandidate,
  type ItemResolutionMatch,
  type ItemResolutionMiss,
} from '@/src/server/ingestion/item-resolution'
import {
  normalizeExactItemName,
  resolveExactItemName,
  type ItemResolutionCandidate,
  type ItemResolutionMiss,
} from '@/src/server/ingestion/item-resolution'

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
