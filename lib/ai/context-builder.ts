/**
 * Context Builder for LLM Conversations
 * Aggregates transaction, weather, and places data for context injection
 */

import { db } from '@/db'
import {
  transactions,
  weather,
  placesCache,
  purchaseOrders,
  inventorySnapshots,
  items,
} from '@/db/schema'
import { eq, gte, and } from 'drizzle-orm'
import { ContextData } from './prompts'
import { generateRecommendations } from '@/lib/recommendations/engine'

/**
 * Build context data from various sources
 * @param locationId - The location to fetch data for
 * @param daysBack - Number of days of transaction history to include (default: 30)
 */
export async function buildContextData(
  locationId: string,
  daysBack: number = 30,
): Promise<ContextData> {
  try {
    const context: ContextData = {}

    // Fetch transaction summary
    const transactionSummary = await buildTransactionSummary(
      locationId,
      daysBack,
    )
    if (transactionSummary) {
      context.transactionSummary = transactionSummary
    }

    const recommendationSummary = await buildRecommendationSummary(locationId)
    if (recommendationSummary) {
      context.recommendationSummary = recommendationSummary
    }

    // Fetch weather data
    const weatherData = await buildWeatherData(locationId)
    if (weatherData) {
      context.weatherData = weatherData
    }

    // Fetch places and donation opportunities
    const placesData = await buildPlacesData(locationId)
    if (placesData) {
      context.placesData = placesData
    }

    return context
  } catch (error) {
    console.error('Error building context data:', error)
    return {}
  }
}

async function buildRecommendationSummary(
  locationId: string,
): Promise<string | null> {
  try {
    const [transactionRows, purchaseRows, inventoryRows, itemRows] =
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
      transactions: transactionRows,
      purchases: purchaseRows,
      inventory: inventoryRows,
      items: itemRows,
    })

    if (result.recommendations.length === 0) return null

    return [
      `Estimated financial risk in surfaced signals: $${result.walletImpact.toFixed(2)}`,
      `History available: ${result.historyWeeks.toFixed(1)} weeks`,
      ...result.recommendations.map(
        (recommendation) =>
          `- ${recommendation.item}: ${recommendation.observation}. Suggested action: ${recommendation.suggestedAction}. Evidence: ${recommendation.evidence.sources.join(', ') || 'none'}.`,
      ),
    ].join('\n')
  } catch (error) {
    console.error('Error building recommendation context:', error)
    return null
  }
}

/**
 * Build transaction summary for the past N days
 */
async function buildTransactionSummary(
  locationId: string,
  daysBack: number,
): Promise<string | null> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysBack)

    const txns = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.locationId, locationId),
          gte(transactions.date, cutoffDate.toISOString().split('T')[0]),
        ),
      )

    if (txns.length === 0) {
      return null
    }

    // Calculate statistics
    const totalRevenue = txns
      .reduce((sum, t) => sum + (parseFloat(t.revenue || '0') || 0), 0)
      .toFixed(2)
    const totalCost = txns
      .reduce((sum, t) => sum + (parseFloat(t.cost || '0') || 0), 0)
      .toFixed(2)
    const totalQuantity = txns
      .reduce((sum, t) => sum + (parseFloat(t.qty) || 0), 0)
      .toFixed(2)

    // Group by item for top items
    const itemMap = new Map<string, { qty: number; revenue: number }>()
    txns.forEach((t) => {
      const existing = itemMap.get(t.item) || { qty: 0, revenue: 0 }
      existing.qty += parseFloat(t.qty) || 0
      existing.revenue += parseFloat(t.revenue || '0') || 0
      itemMap.set(t.item, existing)
    })

    const topItems = Array.from(itemMap.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(
        ([item, data]) =>
          `  - ${item}: ${data.qty.toFixed(1)} units, $${data.revenue.toFixed(2)} revenue`,
      )
      .join('\n')

    return `Period: Last ${daysBack} days
Total Transactions: ${txns.length}
Total Revenue: $${totalRevenue}
Total Cost: $${totalCost}
Total Quantity Moved: ${totalQuantity} units

Top 5 Items by Revenue:
${topItems}`
  } catch (error) {
    console.error('Error building transaction summary:', error)
    return null
  }
}

/**
 * Build weather data summary for location
 */
async function buildWeatherData(locationId: string): Promise<string | null> {
  try {
    const today = new Date().toISOString().split('T')[0]

    const weatherRecords = await db
      .select()
      .from(weather)
      .where(and(eq(weather.locationId, locationId), gte(weather.date, today)))

    if (weatherRecords.length === 0) {
      return null
    }

    const summaries = weatherRecords
      .slice(0, 3)
      .map((w) => {
        const temp = w.temperature ? `${w.temperature}°F` : 'N/A'
        const cond = w.conditions || 'Unknown'
        const precip = w.precipitation ? `${w.precipitation}mm` : '0mm'
        return `  ${w.date}: ${temp}, ${cond}, Precipitation: ${precip}`
      })
      .join('\n')

    return `Current and Upcoming Weather:\n${summaries}`
  } catch (error) {
    console.error('Error building weather data:', error)
    return null
  }
}

/**
 * Build places and donation opportunities data
 */
async function buildPlacesData(locationId: string): Promise<string | null> {
  try {
    const places = await db
      .select()
      .from(placesCache)
      .where(eq(placesCache.locationId, locationId))

    if (places.length === 0) {
      return null
    }

    const placeSummaries = places
      .slice(0, 5)
      .map((p) => {
        const types = p.types
          ? Array.isArray(p.types)
            ? p.types.join(', ')
            : typeof p.types === 'string'
              ? JSON.parse(p.types).join(', ')
              : 'Unknown'
          : 'Unknown'
        return `  - ${p.orgName} (${types})\n    Address: ${p.address || 'N/A'}\n    Phone: ${p.phone || 'N/A'}`
      })
      .join('\n')

    return `Local Organizations and Potential Donation Opportunities:\n${placeSummaries}`
  } catch (error) {
    console.error('Error building places data:', error)
    return null
  }
}
