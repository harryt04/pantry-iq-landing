import { detectColumnMappings } from '@/src/server/csv/mapping'
import {
  buildPrecomputeResults,
  type PrecomputeOrder,
  type PrecomputeSale,
  type PrecomputeSnapshot,
} from '@/src/server/metrics/precompute'

/**
 * The real-world illustration behind every figure on the landing page.
 *
 * Nothing here is written by hand except the raw rows. The dollar amounts,
 * severities, ranking, and arithmetic all come out of the same metric engine
 * the product runs, so the page cannot drift from what the product would say
 * about this data. See `docs/brand/marketing-copy.md` §7 — claims discipline.
 *
 * The figures are generalized from reported restaurant purchasing and waste
 * ranges across common restaurant categories. They represent a real-world
 * bad-month scenario rather than one named operation's exact ledger.
 */

const ANCHOR = new Date('2026-08-08T12:00:00.000Z')
// Four weeks gives the example enough history for a prediction. The fixture
// is intentionally a bad month: it shows what a meaningful exception can look
// like, not an ordinary month's expected shrinkage.
const WINDOW_DAYS = 28

/**
 * The illustration is grounded in a reported restaurant case: $55,000 in
 * monthly food purchases, with unclassified waste moving from 4.1% to 1.3%
 * after controls.
 */
export const marketingMonthlyScale = {
  monthlyFoodPurchases: '$55,000',
  observedVariance: '4.1%',
  modeledShrinkage: '$2,255',
  controlledVariance: '1.3%',
  recoverableGap: '$1,540',
  sourceUrl:
    'https://costorestaurante.com/EN/restaurant-food-waste-management-before-vs-after-masterestaurant-2026-data-and.html',
} as const

function dayOffset(days: number) {
  return new Date(ANCHOR.getTime() - days * 24 * 60 * 60 * 1000)
}

type ExampleItem = {
  id: string
  displayName: string
  unit: string
  costPerUnit: string
  /** Four weeks of purchases, formatted for the marketing surface. */
  monthlyPurchaseValue: string
  shelfLifeDays: number
  /** Units bought each week. */
  weeklyOrder: number
  /** Units sold each time it sells. */
  saleQty: number
  /** How often it sells. 1 is every day; 14 is barely moving. */
  saleEveryDays: number
  /** Revenue per unit sold. */
  pricePerUnit: number
  /** Units sitting in the walk-in at the last count. */
  onHand: number
}

const items: readonly ExampleItem[] = [
  {
    id: 'salmon-fillet',
    displayName: 'Salmon fillet',
    unit: 'lb',
    costPerUnit: '20.00',
    monthlyPurchaseValue: '$12,000',
    shelfLifeDays: 3,
    weeklyOrder: 150,
    saleQty: 5,
    saleEveryDays: 2,
    pricePerUnit: 34,
    onHand: 64,
  },
  {
    id: 'heirloom-tomato',
    displayName: 'Heirloom tomato',
    unit: 'lb',
    costPerUnit: '6.50',
    monthlyPurchaseValue: '$10,400',
    shelfLifeDays: 7,
    weeklyOrder: 400,
    saleQty: 55,
    saleEveryDays: 1,
    pricePerUnit: 11,
    onHand: 160,
  },
  {
    id: 'ribeye-12oz',
    displayName: 'Ribeye 12oz',
    unit: 'ea',
    costPerUnit: '14.00',
    monthlyPurchaseValue: '$14,000',
    shelfLifeDays: 21,
    weeklyOrder: 250,
    saleQty: 35,
    saleEveryDays: 1,
    pricePerUnit: 38,
    onHand: 100,
  },
  {
    id: 'burrata',
    displayName: 'Burrata',
    unit: 'ea',
    costPerUnit: '4.25',
    monthlyPurchaseValue: '$6,800',
    shelfLifeDays: 10,
    weeklyOrder: 400,
    saleQty: 55,
    saleEveryDays: 1,
    pricePerUnit: 14,
    onHand: 160,
  },
  {
    id: 'sourdough-loaf',
    displayName: 'Sourdough loaf',
    unit: 'ea',
    costPerUnit: '3.00',
    monthlyPurchaseValue: '$12,000',
    shelfLifeDays: 5,
    weeklyOrder: 1000,
    saleQty: 135,
    saleEveryDays: 1,
    pricePerUnit: 9,
    onHand: 350,
  },
]

export const marketingMonthlyPurchases = items.map(
  ({ id, displayName, monthlyPurchaseValue }) => ({
    id,
    label: displayName,
    value: monthlyPurchaseValue,
  }),
)

const sales: PrecomputeSale[] = []
const orders: PrecomputeOrder[] = []
const snapshots: PrecomputeSnapshot[] = []

for (const item of items) {
  for (let day = WINDOW_DAYS - 1; day >= 0; day -= 1) {
    if (day % item.saleEveryDays !== 0) continue
    sales.push({
      itemId: item.id,
      qty: item.saleQty.toFixed(2),
      revenue: (item.saleQty * item.pricePerUnit).toFixed(2),
      transactedAt: dayOffset(day),
    })
  }

  for (let week = 3; week >= 0; week -= 1) {
    orders.push({
      itemId: item.id,
      qty: item.weeklyOrder.toFixed(2),
      totalCost: (item.weeklyOrder * Number(item.costPerUnit)).toFixed(2),
      orderedAt: dayOffset(week * 7),
    })
    snapshots.push({
      itemId: item.id,
      qty: (week === 0
        ? item.onHand
        : item.onHand + week * Math.max(item.weeklyOrder - 4, 1)
      ).toFixed(2),
      countedAt: dayOffset(week * 7),
    })
  }
}

export const marketingExample = buildPrecomputeResults(
  {
    items: items.map(
      ({ id, displayName, unit, costPerUnit, shelfLifeDays }) => ({
        id,
        displayName,
        unit,
        costPerUnit,
        shelfLifeDays,
      }),
    ),
    sales,
    orders,
    snapshots,
    sources: [
      {
        filename: 'sales-export.csv',
        source: 'transactions',
        rowCount: sales.length,
        uploadedAt: dayOffset(0),
      },
      {
        filename: 'purchase-orders.csv',
        source: 'purchase_orders',
        rowCount: orders.length,
        uploadedAt: dayOffset(0),
      },
      {
        filename: 'inventory-counts.csv',
        source: 'inventory_snapshots',
        rowCount: snapshots.length,
        uploadedAt: dayOffset(0),
      },
    ],
  },
  ANCHOR,
)

/**
 * A sales export with the column names a POS actually produces. The detection
 * below is the product's own detector — the landing page shows what PantryIQ
 * would really make of this file, not a drawing of it.
 */
const exportPreview = {
  columns: ['ITEM_DESC', 'QTY_SOLD', 'NET_SALES', 'TRN_DT'],
  previewRows: [
    { values: ['Salmon fillet', '15.00', '510.00', '2026-08-08'] },
    { values: ['Heirloom tomato', '55.00', '605.00', '2026-08-08'] },
    { values: ['Ribeye 12oz', '35.00', '1,330.00', '2026-08-07'] },
  ],
}

export const marketingMapping = detectColumnMappings(
  exportPreview as Parameters<typeof detectColumnMappings>[0],
  'transactions',
)

export const marketingExampleRowCount =
  sales.length + orders.length + snapshots.length
