import { describe, expect, it } from 'vitest'

import {
  areUnitsConvertible,
  convertQuantity,
  UnitConversionError,
} from './unit-conversion'

describe('exact recipe unit conversion', () => {
  it('converts mass without using floating-point arithmetic', () => {
    expect(convertQuantity('2', 'lb', 'oz')).toBe('32')
    expect(convertQuantity('16', 'oz', 'lb')).toBe('1')
    expect(convertQuantity('1.5', 'kg', 'g')).toBe('1500')
  })

  it('converts case packs to eaches using an explicit pack size', () => {
    expect(convertQuantity('2.5', 'case', 'each', { casePackSize: '24' })).toBe(
      '60',
    )
    expect(convertQuantity('48', 'each', 'case', { casePackSize: '24' })).toBe(
      '2',
    )
  })

  it('rejects missing pack sizes, incompatible dimensions, and unsafe values', () => {
    expect(() => convertQuantity('1', 'case', 'each')).toThrow(
      UnitConversionError,
    )
    expect(() => convertQuantity('1', 'lb', 'each')).toThrow(
      'measure different kinds',
    )
    expect(() =>
      convertQuantity('1', 'each', 'case', { casePackSize: '3' }),
    ).toThrow('repeating decimal')
    expect(areUnitsConvertible('pounds', 'oz')).toBe(true)
    expect(areUnitsConvertible('pounds', 'each')).toBe(false)
  })
})
