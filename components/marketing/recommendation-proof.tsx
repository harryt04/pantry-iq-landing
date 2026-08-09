import * as React from 'react'

import { RecommendationCard } from '@/components/dashboard/recommendation-card'
import { buildPrecomputeResults } from '@/src/server/metrics/precompute'

const proofResult = buildPrecomputeResults(
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
        filename: 'sales-export.csv',
        source: 'transactions',
        rowCount: 4,
        uploadedAt: new Date('2026-08-08T10:00:00.000Z'),
      },
      {
        filename: 'purchase-orders.csv',
        source: 'purchase_orders',
        rowCount: 3,
        uploadedAt: new Date('2026-08-08T11:00:00.000Z'),
      },
      {
        filename: 'inventory-counts.csv',
        source: 'inventory_snapshots',
        rowCount: 1,
        uploadedAt: new Date('2026-08-08T12:00:00.000Z'),
      },
    ],
  },
  new Date('2026-08-08T12:00:00.000Z'),
)

const proofRecommendation = (() => {
  const recommendation = proofResult.recommendations[0]
  if (!recommendation) {
    throw new Error(
      'The marketing proof recommendation could not be assembled.',
    )
  }
  return recommendation
})()

export function RecommendationProof() {
  return (
    <section
      aria-labelledby="landing-proof-recommendation-title"
      className="landing-recommendation-proof"
    >
      <div className="landing-container landing-recommendation-proof__layout">
        <div className="landing-recommendation-proof__intro">
          <p className="landing-eyebrow">Show, don&apos;t claim</p>
          <h2 id="landing-proof-recommendation-title">
            A recommendation you can check.
          </h2>
          <p>
            This worked example uses the same recommendation card as the
            product. The figures come from imported sales, order, and inventory
            rows, and the arithmetic stays visible underneath.
          </p>
        </div>
        <div className="landing-recommendation-proof__card">
          <RecommendationCard
            locationId="marketing-proof"
            recommendation={proofRecommendation}
            variant="marketing"
          />
        </div>
      </div>
    </section>
  )
}
