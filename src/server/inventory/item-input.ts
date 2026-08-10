export type InventoryItemType = 'ingredient' | 'menu_item'

export type InventoryItemCreateInput = {
  canonicalName: string
  displayName: string
  category?: string | null
  unit: string
  itemType?: InventoryItemType
  shelfLifeDays?: number | null
  costPerUnit?: string | null
  menuPrice?: string | null
  parLevel?: string | null
}

export type InventoryItemUpdateInput = Partial<
  Omit<InventoryItemCreateInput, 'canonicalName'>
> & {
  isActive?: boolean
}

export class InventoryItemValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InventoryItemValidationError'
  }
}

function recordInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new InventoryItemValidationError('An item object is required.')
  }

  return input as Record<string, unknown>
}

function requiredText(input: Record<string, unknown>, field: string): string {
  const value = input[field]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InventoryItemValidationError(`${field} is required.`)
  }

  return value.trim()
}

function optionalText(
  input: Record<string, unknown>,
  field: string,
): string | null | undefined {
  if (!(field in input)) return undefined
  const value = input[field]
  if (value === null) return null
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InventoryItemValidationError(`${field} must be text.`)
  }

  return value.trim()
}

function optionalInteger(
  input: Record<string, unknown>,
  field: string,
): number | null | undefined {
  if (!(field in input)) return undefined
  const value = input[field]
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new InventoryItemValidationError(
      `${field} must be a non-negative integer.`,
    )
  }

  return value
}

function optionalDecimal(
  input: Record<string, unknown>,
  field: string,
): string | null | undefined {
  if (!(field in input)) return undefined
  const value = input[field]
  if (value === null) return null
  if (
    typeof value !== 'string' ||
    !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value.trim())
  ) {
    throw new InventoryItemValidationError(
      `${field} must be a non-negative decimal string.`,
    )
  }

  return value.trim()
}

function optionalItemType(
  input: Record<string, unknown>,
): InventoryItemType | undefined {
  if (!('itemType' in input)) return undefined
  if (input.itemType !== 'ingredient' && input.itemType !== 'menu_item') {
    throw new InventoryItemValidationError(
      'itemType must be ingredient or menu_item.',
    )
  }
  return input.itemType
}

export function validateInventoryItemCreateInput(
  input: unknown,
): InventoryItemCreateInput {
  const values = recordInput(input)
  const item: InventoryItemCreateInput = {
    canonicalName: requiredText(values, 'canonicalName'),
    displayName: requiredText(values, 'displayName'),
    unit: requiredText(values, 'unit'),
  }
  const category = optionalText(values, 'category')
  const shelfLifeDays = optionalInteger(values, 'shelfLifeDays')
  const costPerUnit = optionalDecimal(values, 'costPerUnit')
  const menuPrice = optionalDecimal(values, 'menuPrice')
  const parLevel = optionalDecimal(values, 'parLevel')
  const itemType = optionalItemType(values)

  if (category !== undefined) item.category = category
  if (shelfLifeDays !== undefined) item.shelfLifeDays = shelfLifeDays
  if (costPerUnit !== undefined) item.costPerUnit = costPerUnit
  if (menuPrice !== undefined) item.menuPrice = menuPrice
  if (parLevel !== undefined) item.parLevel = parLevel
  if (itemType !== undefined) item.itemType = itemType

  return item
}

export function validateInventoryItemUpdateInput(
  input: unknown,
): InventoryItemUpdateInput {
  const values = recordInput(input)
  if ('canonicalName' in values) {
    throw new InventoryItemValidationError(
      'canonicalName cannot be changed after creation.',
    )
  }

  const update: InventoryItemUpdateInput = {}
  if ('displayName' in values) {
    update.displayName = requiredText(values, 'displayName')
  }
  if ('category' in values) {
    update.category = optionalText(values, 'category') ?? null
  }
  if ('unit' in values) update.unit = requiredText(values, 'unit')
  const itemType = optionalItemType(values)
  if (itemType !== undefined) update.itemType = itemType
  if ('shelfLifeDays' in values) {
    update.shelfLifeDays = optionalInteger(values, 'shelfLifeDays') ?? null
  }
  if ('costPerUnit' in values) {
    update.costPerUnit = optionalDecimal(values, 'costPerUnit') ?? null
  }
  if ('menuPrice' in values) {
    update.menuPrice = optionalDecimal(values, 'menuPrice') ?? null
  }
  if ('parLevel' in values) {
    update.parLevel = optionalDecimal(values, 'parLevel') ?? null
  }
  if ('isActive' in values) {
    if (typeof values.isActive !== 'boolean') {
      throw new InventoryItemValidationError('isActive must be boolean.')
    }
    update.isActive = values.isActive
  }

  if (Object.keys(update).length === 0) {
    throw new InventoryItemValidationError('At least one field is required.')
  }

  return update
}
