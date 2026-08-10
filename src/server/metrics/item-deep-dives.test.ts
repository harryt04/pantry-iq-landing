import { describe, expect, it } from 'vitest'

import { buildItemDeepDiveGroups, buildItemDeepDives } from './item-deep-dives'

describe('item deep dive data', () => {
  it('keeps exact item totals and resolves the sources shown in detail', () => {
    const [item] = buildItemDeepDives({
      items: [
        {
          id: 'salmon-id',
          displayName: 'Wild Salmon',
          category: 'seafood',
          unit: 'lb',
          costPerUnit: '40',
          shelfLifeDays: null,
        },
      ],
      sales: [
        {
          itemId: 'salmon-id',
          transactedAt: new Date('2026-08-01T12:00:00Z'),
          qty: '0.1',
          revenue: '100.10',
        },
        {
          itemId: 'salmon-id',
          transactedAt: new Date('2026-08-02T12:00:00Z'),
          qty: '0.2',
          revenue: '20.2',
        },
      ],
      orders: [
        {
          itemId: 'salmon-id',
          orderedAt: new Date('2026-07-31T12:00:00Z'),
          qty: '1',
          totalCost: '45.50',
        },
      ],
      snapshots: [
        {
          itemId: 'salmon-id',
          countedAt: new Date('2026-08-03T12:00:00Z'),
          qty: '0.7',
        },
      ],
      metrics: [
        {
          itemId: 'salmon-id',
          metricKey: 'margin',
          status: 'calculated',
          value: '63.3',
          result: {},
        },
        {
          itemId: 'salmon-id',
          metricKey: 'spoilageRisk',
          status: 'calculated',
          value: '31.5',
          result: { inputs: { unitCost: '45.5' } },
        },
      ],
    })

    expect(item).toMatchObject({
      displayName: 'Wild Salmon',
      quantitySold: '0.3',
      quantityOrdered: '1',
      quantityOnHand: '0.7',
      totalRevenue: '120.3',
      sellThroughRate: '30',
      unitCost: '45.5',
      unitCostSource: 'purchase orders',
      shelfLifeDays: 3,
      shelfLifeSource: 'category suggestion',
      shelfLifeCategory: 'Seafood',
      margin: '63.3',
      spoilageRisk: '31.5',
    })
    expect(item?.recentSales).toHaveLength(2)
    expect(item?.recentOrders).toHaveLength(1)
  })

  it('keeps items without calculable rollups visible in the needs-data group', () => {
    const items = buildItemDeepDives({
      items: [
        {
          id: 'known-id',
          displayName: 'Known Item',
          category: null,
          unit: 'each',
          costPerUnit: null,
          shelfLifeDays: null,
        },
        {
          id: 'unknown-id',
          displayName: 'Unnamed Case',
          category: null,
          unit: 'case',
          costPerUnit: null,
          shelfLifeDays: null,
        },
      ],
      sales: [
        {
          itemId: 'known-id',
          transactedAt: new Date('2026-08-02T12:00:00Z'),
          qty: '2',
          revenue: '18',
        },
      ],
      orders: [],
      snapshots: [],
    })

    const groups = buildItemDeepDiveGroups(items)
    expect(groups.topSelling[0]?.displayName).toBe('Known Item')
    expect(groups.needsData[0]?.displayName).toBe('Unnamed Case')
    expect(groups.needsData[0]?.displayName).not.toBe('unknown-id')
  })

  it('sorts operational groups with exact decimal comparisons', () => {
    const items = buildItemDeepDives({
      items: [
        {
          id: 'a',
          displayName: 'Item A',
          category: null,
          unit: 'each',
          costPerUnit: null,
          shelfLifeDays: null,
        },
        {
          id: 'b',
          displayName: 'Item B',
          category: null,
          unit: 'each',
          costPerUnit: null,
          shelfLifeDays: null,
        },
      ],
      sales: [],
      orders: [],
      snapshots: [],
      metrics: [
        {
          itemId: 'a',
          metricKey: 'margin',
          status: 'calculated',
          value: '10.02',
          result: {},
        },
        {
          itemId: 'b',
          metricKey: 'margin',
          status: 'calculated',
          value: '10.2',
          result: {},
        },
      ],
    })

    const groups = buildItemDeepDiveGroups(items)
    expect(groups.lowMargin.map((item) => item.displayName)).toEqual([
      'Item A',
      'Item B',
    ])
  })
})
