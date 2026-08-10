import { describe, expect, it } from 'vitest'

import { marketingExample } from './marketing-example'
import { assumptionOriginLabel, marketingWork } from './marketing-evidence'
import type { RecommendationRecord } from '@/src/server/metrics/recommendations'

function topRecommendation() {
  const recommendation = marketingExample.recommendations[0]
  if (!recommendation) throw new Error('The worked example produced no rows.')
  return recommendation
}

describe('marketing evidence curation', () => {
  it('keeps only the arithmetic that produces the headline figure', () => {
    const work = marketingWork(topRecommendation())

    expect(work).not.toBeNull()
    expect(work?.operator).toBe('qtyOnHand × unitCost')
    expect(work?.result).toBe('$240.00')
    expect(work?.resultLabel).toBe('At risk right now')
    expect(work?.terms.map(({ label }) => label)).toEqual([
      'On hand at the last count',
      'Your unit cost',
    ])
  })

  it('drops engine tuning constants and keeps item-level assumptions', () => {
    const work = marketingWork(topRecommendation())
    const names = work?.assumptions.map(({ name }) => name) ?? []

    expect(names).toEqual(['item.shelfLifeDays'])
    expect(names.some((name) => name.startsWith('metrics.'))).toBe(false)
  })

  it('never labels an input with its variable name', () => {
    const work = marketingWork(topRecommendation())

    for (const term of work?.terms ?? []) {
      expect(term.label).not.toMatch(/^qty|^unit[A-Z]|^raw/)
    }
  })

  it('says plainly when a value is our guess rather than the operator’s', () => {
    expect(assumptionOriginLabel('system-default')).toBe(
      'Our default, not a measurement',
    )
    expect(assumptionOriginLabel('user-set')).toBe('Your value')
  })

  it('returns nothing rather than guessing when there is no dollar basis', () => {
    const withoutBasis: RecommendationRecord = {
      ...topRecommendation(),
      financialImpact: {
        amount: null,
        currency: 'USD',
        basis: 'none',
      },
    }

    expect(marketingWork(withoutBasis)).toBeNull()
  })

  it('carries the row counts the engine was actually given', () => {
    const work = marketingWork(topRecommendation())
    const sales = work?.sources.find(
      ({ filename }) => filename === 'sales-export.csv',
    )

    expect(sales?.rowCount).toBeGreaterThan(0)
    expect(work?.sources).toHaveLength(3)
  })
})
