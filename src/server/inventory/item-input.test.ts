import { describe, expect, it } from 'vitest'

import {
  InventoryItemValidationError,
  validateInventoryItemCreateInput,
  validateInventoryItemUpdateInput,
} from './item-input'

describe('inventory item input contract', () => {
  it('keeps decimal money and quantity values as strings', () => {
    expect(
      validateInventoryItemCreateInput({
        canonicalName: ' salmon fillet ',
        displayName: 'Salmon fillet',
        unit: 'lb',
        costPerUnit: '8.50',
        parLevel: '40',
      }),
    ).toEqual({
      canonicalName: 'salmon fillet',
      displayName: 'Salmon fillet',
      unit: 'lb',
      costPerUnit: '8.50',
      parLevel: '40',
    })
  })

  it('allows nullable editable values without inventing defaults', () => {
    expect(
      validateInventoryItemUpdateInput({
        category: null,
        shelfLifeDays: null,
        costPerUnit: null,
        parLevel: null,
      }),
    ).toEqual({
      category: null,
      shelfLifeDays: null,
      costPerUnit: null,
      parLevel: null,
    })
  })

  it('rejects canonical-name edits and unsafe numeric representations', () => {
    expect(() =>
      validateInventoryItemUpdateInput({ canonicalName: 'new name' }),
    ).toThrow('canonicalName cannot be changed after creation.')
    expect(() =>
      validateInventoryItemCreateInput({
        canonicalName: 'salmon',
        displayName: 'Salmon',
        unit: 'lb',
        costPerUnit: 8.5,
      }),
    ).toThrow(InventoryItemValidationError)
    expect(() => validateInventoryItemUpdateInput({})).toThrow(
      'At least one field is required.',
    )
  })
})
