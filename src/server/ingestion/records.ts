/**
 * The boundary every ingestion source must cross before it can write to the
 * canonical model. Sources may parse different payloads, but they cannot
 * invent source-specific persistence paths.
 */
export type IngestionSource = string

export type IngestionAdapter<TInput> = {
  readonly source: IngestionSource
  normalize(input: TInput): readonly NormalizedIngestionRecord[]
}

export type NormalizedTransaction = {
  kind: 'transaction'
  source: IngestionSource
  externalId: string
  transactedAt: Date
  itemId: string
  rawItemName: string
  category: string | null
  qty: string
  unitPrice: string
  totalRevenue: string
  totalCost: string | null
  grossMargin: string | null
}

export type NormalizedPurchaseOrder = {
  kind: 'purchase_order'
  source: IngestionSource
  externalId: string
  orderedAt: Date
  receivedAt: Date | null
  supplierName: string | null
  lines: NormalizedPurchaseOrderLine[]
}

export type NormalizedPurchaseOrderLine = {
  itemId: string
  rawItemName: string
  qty: string
  unitCost: string
  totalCost: string
}

export type NormalizedInventoryCount = {
  kind: 'inventory'
  source: IngestionSource
  /** Inventory has no external-id column in the canonical schema yet. */
  externalId: string | null
  countedAt: Date
  itemId: string
  qty: string
}

export type NormalizedLaborShift = {
  kind: 'labor'
  source: IngestionSource
  externalId: string
  shiftStart: Date
  shiftEnd: Date | null
  employeeReference: string | null
  role: string
  scheduledHours: string | null
  actualHours: string | null
  laborCost: string | null
}

export type NormalizedIngestionRecord =
  | NormalizedTransaction
  | NormalizedPurchaseOrder
  | NormalizedInventoryCount
  | NormalizedLaborShift

function sourceValue(source: string): string {
  const value = source.trim()
  if (!value) throw new Error('An ingestion source is required.')
  return value
}

function externalIdValue(externalId: string): string {
  const value = externalId.trim()
  if (!value) throw new Error('An external ID is required for this record.')
  return value
}

function itemIdValue(itemId: string): string {
  const value = itemId.trim()
  if (!value) throw new Error('A canonical item ID is required.')
  return value
}

function itemNameValue(rawItemName: string): string {
  const value = rawItemName.trim()
  if (!value) throw new Error('A source item name is required.')
  return value
}

function optionalTextValue(value: string | null, field: string): string | null {
  if (value === null) return null
  const trimmed = value.trim()
  if (trimmed.length > 255) throw new Error(`${field} is too long.`)
  return trimmed || null
}

function roleValue(role: string): string {
  const value = role.trim()
  if (!value) throw new Error('A labor role is required.')
  if (value.length > 255) throw new Error('A labor role is too long.')
  return value
}

function dateValue(value: Date, field: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime()))
    throw new Error(`${field} must be a valid date.`)
  return new Date(value)
}

export function normalizeTransaction(
  input: Omit<NormalizedTransaction, 'kind'>,
): NormalizedTransaction {
  return {
    kind: 'transaction',
    source: sourceValue(input.source),
    externalId: externalIdValue(input.externalId),
    transactedAt: dateValue(input.transactedAt, 'Transaction date'),
    itemId: itemIdValue(input.itemId),
    rawItemName: itemNameValue(input.rawItemName),
    category: input.category?.trim() || null,
    qty: input.qty,
    unitPrice: input.unitPrice,
    totalRevenue: input.totalRevenue,
    totalCost: input.totalCost,
    grossMargin: input.grossMargin,
  }
}

export function normalizePurchaseOrder(
  input: Omit<NormalizedPurchaseOrder, 'kind'>,
): NormalizedPurchaseOrder {
  if (input.lines.length === 0)
    throw new Error('A purchase order must contain a line.')
  return {
    kind: 'purchase_order',
    source: sourceValue(input.source),
    externalId: externalIdValue(input.externalId),
    orderedAt: dateValue(input.orderedAt, 'Order date'),
    receivedAt: input.receivedAt
      ? dateValue(input.receivedAt, 'Received date')
      : null,
    supplierName: input.supplierName?.trim() || null,
    lines: input.lines.map((line) => ({
      itemId: itemIdValue(line.itemId),
      rawItemName: itemNameValue(line.rawItemName),
      qty: line.qty,
      unitCost: line.unitCost,
      totalCost: line.totalCost,
    })),
  }
}

export function normalizeInventoryCount(
  input: Omit<NormalizedInventoryCount, 'kind'>,
): NormalizedInventoryCount {
  return {
    kind: 'inventory',
    source: sourceValue(input.source),
    externalId: input.externalId?.trim() || null,
    countedAt: dateValue(input.countedAt, 'Count date'),
    itemId: itemIdValue(input.itemId),
    qty: input.qty,
  }
}

export function normalizeLaborShift(
  input: Omit<NormalizedLaborShift, 'kind'>,
): NormalizedLaborShift {
  if (input.scheduledHours === null && input.actualHours === null)
    throw new Error('Scheduled or actual labor hours are required.')
  const shiftStart = dateValue(input.shiftStart, 'Shift start')
  const shiftEnd = input.shiftEnd
    ? dateValue(input.shiftEnd, 'Shift end')
    : null
  if (shiftEnd && shiftEnd < shiftStart)
    throw new Error('Shift end cannot be before shift start.')
  return {
    kind: 'labor',
    source: sourceValue(input.source),
    externalId: externalIdValue(input.externalId),
    shiftStart,
    shiftEnd,
    employeeReference: optionalTextValue(
      input.employeeReference,
      'Employee reference',
    ),
    role: roleValue(input.role),
    scheduledHours: input.scheduledHours,
    actualHours: input.actualHours,
    laborCost: input.laborCost,
  }
}
