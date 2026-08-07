import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import {
  locations,
  transactions,
  csvUploads,
  posConnections,
  conversations,
  items,
  purchaseOrders,
  inventorySnapshots,
} from '@/db/schema'
import { eq, and, count, desc, sql, inArray } from 'drizzle-orm'
import {
  generateRecommendations,
  type Recommendation,
} from '@/lib/recommendations/engine'

interface DashboardData {
  locations: Array<{
    id: string
    name: string
    type: string
    transactionCount: number
    csvUploadCount: number
    posConnectionStatus: string | null
    conversationId: string | null
  }>
  recentCsvUploads: Array<{
    id: string
    filename: string
    status: string
    uploadedAt: Date
    locationName: string
    locationId: string
    errorDetails: string | null
  }>
  totalLocations: number
  totalTransactions: number
  selectedLocationId: string | null
  walletImpact: number
  historyWeeks: number
  recommendations: Recommendation[]
}

// GET /api/dashboard - Get dashboard data for current user
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all locations for the user
    const userLocations = await db
      .select()
      .from(locations)
      .where(eq(locations.userId, session.user.id))

    const requestedLocationId = new URL(req.url).searchParams.get('location_id')
    const selectedLocation =
      userLocations.find((location) => location.id === requestedLocationId) ||
      userLocations[0]

    // Get user's location IDs for scoping queries
    const userLocationIds = userLocations.map((loc) => loc.id)

    // Aggregate transaction counts by location in a single query
    // Only include transactions from user's locations
    const transactionCounts = await db
      .select({
        locationId: transactions.locationId,
        count: count().as('count'),
      })
      .from(transactions)
      .where(
        userLocationIds.length > 0
          ? inArray(transactions.locationId, userLocationIds)
          : eq(sql`1`, sql`0`), // Return empty result if user has no locations
      )
      .groupBy(transactions.locationId)

    const txCountMap = Object.fromEntries(
      transactionCounts.map((tc) => [tc.locationId, tc.count || 0]),
    )

    // Aggregate CSV upload counts by location in a single query
    // Only include uploads from user's locations
    const csvCounts = await db
      .select({
        locationId: csvUploads.locationId,
        count: count().as('count'),
      })
      .from(csvUploads)
      .where(
        userLocationIds.length > 0
          ? inArray(csvUploads.locationId, userLocationIds)
          : eq(sql`1`, sql`0`), // Return empty result if user has no locations
      )
      .groupBy(csvUploads.locationId)

    const csvCountMap = Object.fromEntries(
      csvCounts.map((cc) => [cc.locationId, cc.count || 0]),
    )

    // Fetch POS connections for user's locations in a single query
    const allPosConnections = await db
      .select()
      .from(posConnections)
      .where(
        userLocationIds.length > 0
          ? inArray(posConnections.locationId, userLocationIds)
          : eq(sql`1`, sql`0`), // Return empty result if user has no locations
      )
    const posMap = Object.fromEntries(
      allPosConnections.map((pos) => [pos.locationId, pos.syncState || null]),
    )

    // Fetch conversations for user's locations in a single query
    const allConversations = await db
      .select()
      .from(conversations)
      .where(
        userLocationIds.length > 0
          ? inArray(conversations.locationId, userLocationIds)
          : eq(sql`1`, sql`0`), // Return empty result if user has no locations
      )
    const convMap = Object.fromEntries(
      allConversations
        .reduce((acc, conv) => {
          if (!acc.has(conv.locationId)) {
            acc.set(conv.locationId, conv.id)
          }
          return acc
        }, new Map<string, string>())
        .entries(),
    )

    // Build locations data from aggregated queries
    const locationsData = userLocations.map((location) => ({
      id: location.id,
      name: location.name,
      type: location.type,
      transactionCount: txCountMap[location.id] || 0,
      csvUploadCount: csvCountMap[location.id] || 0,
      posConnectionStatus: posMap[location.id] || null,
      conversationId: convMap[location.id] || null,
    }))

    // Get recent CSV uploads (last 5) across all locations
    const recentUploads = await db
      .select({
        id: csvUploads.id,
        filename: csvUploads.filename,
        status: csvUploads.status,
        uploadedAt: csvUploads.uploadedAt,
        locationId: csvUploads.locationId,
        errorDetails: csvUploads.errorDetails,
      })
      .from(csvUploads)
      .innerJoin(
        locations,
        and(
          eq(csvUploads.locationId, locations.id),
          eq(locations.userId, session.user.id),
        ),
      )
      .orderBy(desc(csvUploads.uploadedAt))
      .limit(5)

    // Map location names to uploads
    const recentCsvUploads = recentUploads.map((upload) => {
      const locationName =
        locationsData.find((l) => l.id === upload.locationId)?.name || 'Unknown'
      return {
        id: upload.id,
        filename: upload.filename,
        status: upload.status,
        uploadedAt: upload.uploadedAt,
        locationName,
        locationId: upload.locationId,
        errorDetails: upload.errorDetails,
      }
    })

    // Calculate totals
    const totalTransactions = locationsData.reduce(
      (sum, l) => sum + l.transactionCount,
      0,
    )

    let recommendations: Recommendation[] = []
    let walletImpact = 0
    let historyWeeks = 0

    if (selectedLocation) {
      const [
        recommendationTransactions,
        recommendationPurchases,
        recommendationInventory,
        itemDefinitions,
      ] = await Promise.all([
        db
          .select()
          .from(transactions)
          .where(eq(transactions.locationId, selectedLocation.id)),
        db
          .select()
          .from(purchaseOrders)
          .where(eq(purchaseOrders.locationId, selectedLocation.id)),
        db
          .select()
          .from(inventorySnapshots)
          .where(eq(inventorySnapshots.locationId, selectedLocation.id)),
        db
          .select()
          .from(items)
          .where(eq(items.locationId, selectedLocation.id)),
      ])

      const result = generateRecommendations({
        transactions: recommendationTransactions,
        purchases: recommendationPurchases,
        inventory: recommendationInventory,
        items: itemDefinitions,
      })
      recommendations = result.recommendations
      walletImpact = result.walletImpact
      historyWeeks = result.historyWeeks
    }

    const dashboardData: DashboardData = {
      locations: locationsData,
      recentCsvUploads,
      totalLocations: locationsData.length,
      totalTransactions,
      selectedLocationId: selectedLocation?.id || null,
      walletImpact,
      historyWeeks,
      recommendations,
    }

    return NextResponse.json(dashboardData, { status: 200 })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 },
    )
  }
}
