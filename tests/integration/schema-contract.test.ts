import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../drizzle/0000_wealthy_jetstream.sql', import.meta.url),
  'utf8',
)

const canonicalTables = [
  'csv_upload_history',
  'inventory_items',
  'inventory_snapshots',
  'locations',
  'purchase_order_items',
  'purchase_orders',
  'transactions',
] as const

const canonicalIndexes = [
  'inventory_items_location_canonical_name_idx',
  'inventory_snapshots_location_counted_at_idx',
  'purchase_order_items_location_inventory_item_idx',
  'purchase_orders_location_source_external_id_idx',
  'transactions_location_menu_item_idx',
  'transactions_location_transacted_at_idx',
  'transactions_location_source_external_id_idx',
] as const

describe('canonical migration contract', () => {
  it('contains exactly the foundation tables and indexes', () => {
    const tables = [...migration.matchAll(/CREATE TABLE "([^"]+)"/g)].map(
      (match) => match[1],
    )
    const indexes = [
      ...migration.matchAll(/CREATE (?:UNIQUE )?INDEX "([^"]+)"/g),
    ].map((match) => match[1])

    expect(tables).toEqual([...canonicalTables].sort())
    expect(indexes.sort()).toEqual([...canonicalIndexes].sort())
    expect(migration).not.toMatch(/donation|recipient|offer/i)
  })

  it('keeps money, quantities, and timestamps in their exact database types', () => {
    expect(migration).not.toMatch(/\b(?:real|float|double precision)\b/i)

    for (const column of [
      'qty',
      'unit_price',
      'total_revenue',
      'total_cost',
      'gross_margin',
      'unit_cost',
      'total_cost',
      'cost_per_unit',
      'par_level',
    ]) {
      expect(migration).toMatch(new RegExp(`"${column}" numeric(?:[ ,]|$)`))
    }

    expect(migration).not.toMatch(/timestamp(?! with time zone)/i)
  })

  it('includes the restaurant business-day fields on locations', () => {
    const locationTable = migration.match(
      /CREATE TABLE "locations" \(([\s\S]*?)\n\);/,
    )?.[1]

    expect(locationTable).toBeDefined()
    expect(locationTable).toMatch(
      /"timezone" text DEFAULT 'America\/Denver' NOT NULL/,
    )
    expect(locationTable).toMatch(
      /"business_day_boundary" time DEFAULT '04:00:00' NOT NULL/,
    )
  })
})
