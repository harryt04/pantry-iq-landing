import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../drizzle/0000_wealthy_jetstream.sql', import.meta.url),
  'utf8',
)
const itemMasterMigration = readFileSync(
  new URL('../../drizzle/0002_ambitious_paibok.sql', import.meta.url),
  'utf8',
)
const recipeMigration = readFileSync(
  new URL('../../drizzle/0003_recipe_model.sql', import.meta.url),
  'utf8',
)
const recipeCostMigration = readFileSync(
  new URL('../../drizzle/0004_jazzy_karen_page.sql', import.meta.url),
  'utf8',
)
const locationManagementMigration = readFileSync(
  new URL('../../drizzle/0005_bouncy_vector.sql', import.meta.url),
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

  it('makes canonical item names unique within each location', () => {
    expect(itemMasterMigration).toMatch(
      /CREATE UNIQUE INDEX "inventory_items_location_canonical_name_idx" ON "inventory_items" USING btree \("location_id","canonical_name"\)/,
    )
  })

  it('adds an optional recipe model without donation tables', () => {
    expect(recipeMigration).toMatch(
      /ADD COLUMN "item_type" text DEFAULT 'ingredient' NOT NULL/,
    )
    expect(recipeMigration).toMatch(
      /CREATE TABLE "recipes"[\s\S]*"menu_item_id" uuid NOT NULL[\s\S]*"waste_factor" numeric DEFAULT '0' NOT NULL/,
    )
    expect(recipeMigration).toMatch(
      /CREATE TABLE "recipe_ingredients"[\s\S]*exactly_one_target_check/,
    )
    expect(recipeMigration).toMatch(
      /CREATE TABLE "item_unit_conversions"[\s\S]*"factor" numeric NOT NULL/,
    )
    expect(recipeMigration).toMatch(
      /item_unit_conversions_item_units_idx.*location_id.*inventory_item_id.*from_unit.*to_unit/,
    )
    expect(recipeMigration).not.toMatch(/donation|recipient|offer/i)
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

  it('adds menu pricing and durable recipe cost evidence without floats', () => {
    expect(recipeCostMigration).toMatch(/ADD COLUMN "menu_price" numeric/)
    expect(recipeCostMigration).toMatch(
      /CREATE TABLE "recipe_cost_history"[\s\S]*"batch_cost" numeric[\s\S]*"cost_per_output" numeric[\s\S]*"food_cost_percentage" numeric[\s\S]*"evidence" jsonb/,
    )
    expect(recipeCostMigration).toMatch(
      /recipe_cost_history_location_recipe_calculated_idx/,
    )
    expect(recipeCostMigration).not.toMatch(
      /\b(?:real|float|double precision)\b/i,
    )
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

  it('adds an explicit archive state for location management', () => {
    expect(locationManagementMigration).toMatch(
      /ALTER TABLE "locations" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL/,
    )
  })
})
