import { describe, expect, it } from 'vitest'

import { buildPrecomputeResults } from './precompute'
import { assembleRecommendationRecords } from './recommendations'

const now = new Date('2026-08-08T12:00:00.000Z')

describe('recommendation records', () => {
  it('assembles the salmon example with separate facts, prediction, and suggestion', () => {
    const result = buildPrecomputeResults(
      {
        items: [
          {
            id: 'salmon',
            displayName: 'Salmon',
            unit: 'lb',
            costPerUnit: '20',
          },
        ],
        sales: ['2026-07-01', '2026-07-15', '2026-08-01', '2026-08-08'].map(
          (date) => ({
            itemId: 'salmon',
            qty: '0',
            revenue: '0',
            transactedAt: new Date(`${date}T12:00:00.000Z`),
          }),
        ),
        orders: ['2026-07-01', '2026-07-15', '2026-08-01'].map((date) => ({
          itemId: 'salmon',
          qty: '1',
          totalCost: '20',
          orderedAt: new Date(`${date}T12:00:00.000Z`),
        })),
        snapshots: [
          {
            itemId: 'salmon',
            qty: '2',
            countedAt: new Date('2026-08-08T12:00:00.000Z'),
          },
        ],
        sources: [
          {
            filename: 'salmon-sales.csv',
            source: 'transactions',
            rowCount: 4,
            uploadedAt: new Date('2026-08-08T10:00:00.000Z'),
          },
          {
            filename: 'salmon-orders.csv',
            source: 'purchase_orders',
            rowCount: 3,
            uploadedAt: new Date('2026-08-08T11:00:00.000Z'),
          },
          {
            filename: 'salmon-counts.csv',
            source: 'inventory_snapshots',
            rowCount: 1,
            uploadedAt: new Date('2026-08-08T12:00:00.000Z'),
          },
        ],
      },
      now,
    )

    expect(result.recommendations).toHaveLength(1)
    expect(result.recommendations[0]).toMatchObject({
      version: 1,
      itemId: 'salmon',
      itemName: 'Salmon',
      rank: 1,
      observation: {
        purchaseOrderCount: 3,
        quantityOrdered: '3',
        quantitySold: '0',
        sellThroughRate: '0',
        quantityOnHand: '2',
        unit: 'lb',
      },
      financialImpact: {
        amount: '40',
        currency: 'USD',
        basis: 'currentSpoilage',
      },
      prediction: {
        type: 'reorder',
        outcome: 'unlikely-to-sell',
        basis: {
          source: 'transactions',
          minimumHistoryWeeks: '4',
        },
      },
      suggestedAction: {
        framing: 'consider',
        action: 'reduce-next-order-or-pull-from-menu',
        timeHorizon: 'this week',
      },
      dataFindings: [],
    })
    expect(result.recommendations[0]?.prediction?.basis.historyWeeks).toBe('5')
    expect(result.recommendations[0]).not.toHaveProperty(
      'observation.confidence',
    )
    expect(result.recommendations[0]?.evidenceTraceRef).toEqual({
      key: 'recommendation:salmon:2026-07-01T12:00:00.000Z:2026-08-08T12:00:00.000Z',
      itemId: 'salmon',
      inputWindowStart: '2026-07-01T12:00:00.000Z',
      inputWindowEnd: '2026-08-08T12:00:00.000Z',
    })
    const trace = result.recommendations[0]?.evidenceTrace
    expect(trace?.version).toBe(1)
    expect(trace?.sources).toEqual([
      {
        filename: 'salmon-sales.csv',
        source: 'transactions',
        rowCount: 4,
        uploadedAt: '2026-08-08T10:00:00.000Z',
      },
      {
        filename: 'salmon-orders.csv',
        source: 'purchase_orders',
        rowCount: 3,
        uploadedAt: '2026-08-08T11:00:00.000Z',
      },
      {
        filename: 'salmon-counts.csv',
        source: 'inventory_snapshots',
        rowCount: 1,
        uploadedAt: '2026-08-08T12:00:00.000Z',
      },
    ])
    expect(trace?.calculations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'metric:sellThrough',
          operator: 'qtySold / qtyOrdered × 100',
          inputs: { qtySold: '0', qtyOrdered: '3', unit: 'lb' },
          result: '0',
        }),
        expect.objectContaining({
          id: 'metric:impact.currentSpoilage.amount',
          result: '40',
        }),
        expect.objectContaining({ id: 'ranking:score', result: '29.2' }),
      ]),
    )
    expect(trace?.assumptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'metrics.ranking.weights.impact',
          value: '0.40',
          origin: 'system-default',
        }),
      ]),
    )
  })

  it('keeps financial impact null when the item has no cost data', () => {
    const [recommendation] = assembleRecommendationRecords({
      items: [
        {
          itemId: 'beans',
          itemName: 'Beans',
          unit: 'lb',
          purchaseOrderCount: 1,
          metrics: [
            {
              metricKey: 'sellThrough',
              status: 'calculated',
              value: '0',
              result: {
                status: 'calculated',
                value: '0',
                inputs: { qtyOrdered: '5', qtySold: '0' },
                units: { value: '%' },
              },
            },
            {
              metricKey: 'impact',
              status: 'calculated',
              value: '31',
              result: {
                status: 'calculated',
                value: '31',
                dollarReason:
                  'dollars cannot be calculated from the available data',
                categories: {
                  currentSpoilage: {
                    status: 'calculated',
                    scoreBasis: 'units',
                    value: null,
                  },
                },
              },
            },
          ],
        },
      ],
      rankedItems: [
        {
          itemId: 'beans',
          rank: 1,
          score: '20',
          dimensions: {
            impact: { score: '31', weight: '0.4' },
            urgency: { score: '0', weight: '0.4' },
            dataSufficiency: { score: '0', weight: '0.2' },
          },
        },
      ],
      inputWindowStart: new Date('2026-08-01T12:00:00.000Z'),
      inputWindowEnd: new Date('2026-08-08T12:00:00.000Z'),
    })

    expect(recommendation?.financialImpact).toEqual({
      amount: null,
      currency: 'USD',
      basis: 'none',
      explanation: 'dollars cannot be calculated from the available data',
    })
    expect(recommendation).not.toHaveProperty('prediction')
  })
})
