import { describe, expect, it } from 'vitest'

import { buildPrecomputeResults } from '@/src/server/metrics/precompute'

import {
  buildMenuRecommendationCandidates,
  rankMenuRecommendations,
} from './menu-recommendations'

describe('menu recommendations', () => {
  it('builds all three recipe-derived findings with explicit provenance', () => {
    const candidates = buildMenuRecommendationCandidates({
      marginErosion: [
        {
          itemId: 'burger',
          itemName: 'Burger',
          unit: 'plates',
          marginPerItem: '4',
          marginThreshold: '10',
          unitsSold: '20',
        },
      ],
      recipeVariance: [
        {
          ingredientItemId: 'beef',
          ingredientName: 'Beef',
          unit: 'lb',
          variance: '4',
          variancePercent: '25',
          ingredientCostPerUnit: null,
        },
      ],
      ingredientCostIncrease: [
        {
          ingredientItemId: 'pasta',
          ingredientName: 'Pasta',
          unit: 'plates',
          previousBatchCost: '20',
          currentBatchCost: '30',
          previousMenuPrice: '18',
          currentMenuPrice: '18',
          unitsSold: '12',
        },
      ],
    })

    expect(candidates.map((candidate) => candidate.type)).toEqual([
      'margin-erosion',
      'recipe-variance',
      'ingredient-cost-increase',
    ])
    expect(candidates[0]).toMatchObject({
      impactAmount: '120',
      dimensions: { impact: '100' },
    })
    expect(candidates[1]).toMatchObject({
      impactAmount: null,
      impactBasis: 'none',
    })
    expect(candidates[0]?.metrics[0]?.result.reason).toContain(
      'Recipe-derived figure',
    )
  })

  it('uses the existing ranking formula for menu candidates', () => {
    const candidates = buildMenuRecommendationCandidates({
      marginErosion: [
        {
          itemId: 'lower',
          itemName: 'Lower',
          unit: 'plates',
          marginPerItem: '8',
          marginThreshold: '10',
          unitsSold: '5',
        },
        {
          itemId: 'higher',
          itemName: 'Higher',
          unit: 'plates',
          marginPerItem: '0',
          marginThreshold: '10',
          unitsSold: '20',
        },
      ],
    })

    expect(
      rankMenuRecommendations(candidates).map(({ itemId }) => itemId),
    ).toEqual(['menu:margin-erosion:higher', 'menu:margin-erosion:lower'])
  })

  it('lets recipe-derived findings compete with inventory recommendations', () => {
    const result = buildPrecomputeResults(
      {
        items: [
          {
            id: 'salmon',
            displayName: 'Salmon',
            unit: 'lb',
            costPerUnit: '10',
            shelfLifeDays: 3,
          },
        ],
        sales: [],
        orders: [],
        snapshots: [],
        menuRecommendations: {
          marginErosion: [
            {
              itemId: 'salmon',
              itemName: 'Salmon plate',
              unit: 'plates',
              marginPerItem: '0',
              marginThreshold: '20',
              unitsSold: '10',
            },
          ],
        },
      },
      new Date('2026-08-08T12:00:00.000Z'),
    )

    expect(result.recommendations).toHaveLength(1)
    expect(result.recommendations[0]).toMatchObject({
      itemId: 'salmon',
      recommendationType: 'margin-erosion',
      recipeDerived: true,
      rank: 1,
      menuFinding: { label: 'Recipe-derived signal', value: '0' },
    })
    expect(result.recommendations[0]?.evidenceTrace?.calculations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          explanation: expect.stringContaining('Recipe-derived figure'),
        }),
      ]),
    )
  })
})
