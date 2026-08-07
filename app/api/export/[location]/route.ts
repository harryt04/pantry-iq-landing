import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import {
  inventorySnapshots,
  items,
  locations,
  purchaseOrders,
  transactions,
} from '@/db/schema'
import { generateRecommendations } from '@/lib/recommendations/engine'
import { toCSV } from '@/lib/csv/export'

type ExportType =
  | 'transactions'
  | 'purchase_orders'
  | 'inventory_snapshots'
  | 'recommendations'

const exportTypes: ExportType[] = [
  'transactions',
  'purchase_orders',
  'inventory_snapshots',
  'recommendations',
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ location: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { location: locationId } = await params
  const type = request.nextUrl.searchParams.get('type') as ExportType | null
  if (!type || !exportTypes.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${exportTypes.join(', ')}` },
      { status: 400 },
    )
  }

  const ownedLocation = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(eq(locations.id, locationId), eq(locations.userId, session.user.id)),
    )

  if (ownedLocation.length === 0) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  let headers: string[]
  let rows: unknown[][]

  if (type === 'transactions') {
    const records = await db
      .select()
      .from(transactions)
      .where(eq(transactions.locationId, locationId))
    headers = ['date', 'item', 'qty', 'revenue', 'cost', 'source']
    rows = records.map((record) => [
      record.date,
      record.item,
      record.qty,
      record.revenue,
      record.cost,
      record.source,
    ])
  } else if (type === 'purchase_orders') {
    const records = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.locationId, locationId))
    headers = [
      'purchaseDate',
      'item',
      'qty',
      'unitCost',
      'totalCost',
      'supplier',
      'deliveryDate',
      'source',
    ]
    rows = records.map((record) => [
      record.purchaseDate,
      record.item,
      record.qty,
      record.unitCost,
      record.totalCost,
      record.supplier,
      record.deliveryDate,
      record.source,
    ])
  } else if (type === 'inventory_snapshots') {
    const records = await db
      .select()
      .from(inventorySnapshots)
      .where(eq(inventorySnapshots.locationId, locationId))
    headers = ['snapshotDate', 'item', 'qtyOnHand', 'snapshotType', 'source']
    rows = records.map((record) => [
      record.snapshotDate,
      record.item,
      record.qtyOnHand,
      record.snapshotType,
      record.source,
    ])
  } else {
    const [transactionRecords, purchaseRecords, inventoryRecords, itemRecords] =
      await Promise.all([
        db
          .select()
          .from(transactions)
          .where(eq(transactions.locationId, locationId)),
        db
          .select()
          .from(purchaseOrders)
          .where(eq(purchaseOrders.locationId, locationId)),
        db
          .select()
          .from(inventorySnapshots)
          .where(eq(inventorySnapshots.locationId, locationId)),
        db.select().from(items).where(eq(items.locationId, locationId)),
      ])
    const result = generateRecommendations({
      transactions: transactionRecords,
      purchases: purchaseRecords,
      inventory: inventoryRecords,
      items: itemRecords,
    })
    headers = [
      'item',
      'type',
      'observation',
      'financialImpact',
      'prediction',
      'suggestedAction',
      'impactScore',
      'urgencyScore',
      'confidenceScore',
      'rankScore',
    ]
    rows = result.recommendations.map((record) => [
      record.item,
      record.type,
      record.observation,
      record.financialImpact,
      record.prediction,
      record.suggestedAction,
      record.impactScore,
      record.urgencyScore,
      record.confidenceScore,
      record.rankScore,
    ])
  }

  return new NextResponse(toCSV(headers, rows), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pantryiq-${type}-${locationId}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
