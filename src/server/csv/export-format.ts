import { serializeCsvRow } from './security'

export const CSV_EXPORT_TYPES = [
  'transactions',
  'purchase_orders',
  'inventory_items',
  'inventory_snapshots',
] as const

export type CsvExportType = (typeof CSV_EXPORT_TYPES)[number]

type Cell = Date | number | string | null | undefined

const headersByType: Record<CsvExportType, readonly string[]> = {
  transactions: [
    'transaction date',
    'external id',
    'item name',
    'category',
    'quantity',
    'unit price',
    'total revenue',
    'total cost',
    'gross margin',
  ],
  purchase_orders: [
    'order date',
    'received date',
    'external id',
    'supplier name',
    'item name',
    'quantity',
    'unit cost',
    'total cost',
  ],
  inventory_items: [
    'item id',
    'canonical name',
    'item name',
    'category',
    'unit',
    'item type',
    'shelf life days',
    'cost per unit',
    'menu price',
    'par level',
    'active',
  ],
  inventory_snapshots: [
    'count date',
    'snapshot id',
    'item name',
    'quantity',
    'category',
    'unit',
    'shelf life days',
  ],
}

function cell(value: Cell): string {
  if (value === null || value === undefined) return ''
  return value instanceof Date ? value.toISOString() : String(value)
}

export function csvExportDocument(
  type: CsvExportType,
  rows: readonly (readonly Cell[])[],
): string {
  return [
    serializeCsvRow(headersByType[type]),
    ...rows.map((row) => serializeCsvRow(row.map(cell))),
  ].join('')
}

export function isCsvExportType(value: string): value is CsvExportType {
  return (CSV_EXPORT_TYPES as readonly string[]).includes(value)
}
