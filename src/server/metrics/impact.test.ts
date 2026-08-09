import { describe, expect, it } from 'vitest'

import { calculateImpact } from './impact'

describe('impact score', () => {
  it('reproduces the salmon dollar categories and retains each contribution', () => {
    const result = calculateImpact({
      qtyOnHand: '2',
      historicalSpoilageQty: '0',
      qtyOrdered: '2',
      qtySold: '0',
      revenue: '0',
      costOfSales: '0',
      unitCost: '20.00',
      unit: 'lb',
      currency: 'USD',
    })

    expect(result).toMatchObject({ status: 'calculated', value: '26' })
    expect(result.categories).toMatchObject({
      currentSpoilage: {
        status: 'calculated',
        value: '40',
        score: '40',
        scoreBasis: 'dollars',
      },
      historicalSpoilage: {
        status: 'calculated',
        value: '0',
        score: '0',
        scoreBasis: 'dollars',
      },
      overordering: {
        status: 'calculated',
        value: '40',
        score: '40',
        scoreBasis: 'dollars',
      },
      marginLoss: {
        status: 'calculated',
        value: '0',
        score: '0',
        scoreBasis: 'dollars',
      },
    })
    expect(result.dollarsAvailable).toBe(true)
  })

  it('uses unit signals when no unit costs exist and says dollars are unavailable', () => {
    const result = calculateImpact({
      qtyOnHand: '2',
      historicalSpoilageQty: '3',
      qtyOrdered: '5',
      qtySold: '0',
      unit: 'lb',
      currency: 'USD',
    })

    expect(result).toMatchObject({
      status: 'calculated',
      value: '31',
      dollarsAvailable: false,
      dollarReason: 'dollars cannot be calculated from the available data',
    })
    expect(result.categories.currentSpoilage).toMatchObject({
      value: null,
      score: '20',
      scoreBasis: 'units',
      unitSignal: '2',
    })
    expect(result.categories.overordering).toMatchObject({
      value: null,
      score: '50',
      scoreBasis: 'units',
      unitSignal: '5',
    })
    expect(result.categories.marginLoss.status).toBe('suppressed')
  })

  it('suppresses missing categories and renormalizes active configured weights', () => {
    const result = calculateImpact(
      { qtyOnHand: '2', unitCost: '1', unit: 'each' },
      {
        weights: { currentSpoilage: 100 },
        highImpactDollars: '50',
      },
    )

    expect(result).toMatchObject({ status: 'calculated', value: '4' })
    expect(result.categories.currentSpoilage).toMatchObject({
      score: '4',
      scoreBasis: 'dollars',
    })
    expect(result.categories.historicalSpoilage.status).toBe('suppressed')
    expect(result.inputs.weightTotal).toBe('100')
  })
})
