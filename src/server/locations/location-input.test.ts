import { describe, expect, it } from 'vitest'

import {
  LocationValidationError,
  validateLocationCreateInput,
  validateLocationUpdateInput,
} from './location-input'

describe('location input validation', () => {
  it('trims a required name and optional address', () => {
    expect(
      validateLocationCreateInput({
        name: '  Downtown  ',
        address: '  100 Main Street  ',
      }),
    ).toEqual({ name: 'Downtown', address: '100 Main Street' })
  })

  it('allows an omitted or blank address', () => {
    expect(validateLocationCreateInput({ name: 'Downtown' })).toEqual({
      name: 'Downtown',
    })
    expect(
      validateLocationCreateInput({ name: 'Downtown', address: '  ' }),
    ).toEqual({ name: 'Downtown', address: null })
  })

  it('rejects missing and overlong fields', () => {
    expect(() => validateLocationCreateInput({ name: '  ' })).toThrow(
      LocationValidationError,
    )
    expect(() =>
      validateLocationCreateInput({ name: 'x'.repeat(121) }),
    ).toThrow('120 characters')
    expect(() =>
      validateLocationCreateInput({
        name: 'Downtown',
        address: 'x'.repeat(241),
      }),
    ).toThrow('240 characters')
  })

  it('only accepts location fields during updates', () => {
    expect(
      validateLocationUpdateInput({ name: 'Uptown', isActive: false }),
    ).toEqual({ name: 'Uptown', isActive: false })
    expect(() => validateLocationUpdateInput({})).toThrow(
      'location detail to update',
    )
    expect(() => validateLocationUpdateInput({ isActive: 'false' })).toThrow(
      'isActive must be boolean',
    )
  })
})
