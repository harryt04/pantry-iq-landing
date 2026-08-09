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
const metricStoreMigration = readFileSync(
  new URL('../../drizzle/0008_metric_store.sql', import.meta.url),
  'utf8',
)
const importHistoryMigration = readFileSync(
  new URL('../../drizzle/0009_loose_epoch.sql', import.meta.url),
  'utf8',
)
const connectorMigration = readFileSync(
  new URL('../../drizzle/0010_connector_framework.sql', import.meta.url),
  'utf8',
)
const reconciliationMigration = readFileSync(
  new URL('../../drizzle/0011_boring_bulldozer.sql', import.meta.url),
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

  it('adds durable metric runs, item results, and location rollups', () => {
    expect(metricStoreMigration).toMatch(
      /CREATE TABLE "metric_runs"[\s\S]*"status" text NOT NULL[\s\S]*"input_window_start" timestamp with time zone/,
    )
    expect(metricStoreMigration).toMatch(
      /CREATE TABLE "metric_results"[\s\S]*"value" numeric[\s\S]*"result" jsonb NOT NULL[\s\S]*metric_results_run_item_key_idx/,
    )
    expect(metricStoreMigration).toMatch(
      /CREATE TABLE "metric_rollups"[\s\S]*"value" numeric[\s\S]*"result" jsonb NOT NULL[\s\S]*metric_rollups_run_key_idx/,
    )
    expect(metricStoreMigration).not.toMatch(
      /\b(?:real|float|double precision)\b/i,
    )
  })

  it('adds an explicit archive state for location management', () => {
    expect(locationManagementMigration).toMatch(
      /ALTER TABLE "locations" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL/,
    )
  })

  it('keeps item-resolution evidence durable for history drill-downs', () => {
    expect(importHistoryMigration).toContain(
      'ALTER TABLE "csv_upload_history" ADD COLUMN "item_resolution" jsonb',
    )
  })

  it('stores connector credentials encrypted and makes sync/webhook state durable', () => {
    expect(connectorMigration).toMatch(
      /CREATE TABLE "connector_connections"[\s\S]*"encrypted_credentials" text NOT NULL[\s\S]*"sync_cursor" text[\s\S]*"backfill_cursor" text/,
    )
    expect(connectorMigration).toMatch(
      /CREATE TABLE "connector_oauth_states"[\s\S]*"state_hash" text NOT NULL[\s\S]*"expires_at" timestamp with time zone NOT NULL[\s\S]*"consumed_at" timestamp with time zone/,
    )
    expect(connectorMigration).toMatch(
      /CREATE TABLE "connector_webhook_deliveries"[\s\S]*"provider_event_id" text NOT NULL[\s\S]*"payload_hash" text NOT NULL[\s\S]*"processed_at" timestamp with time zone/,
    )
    expect(connectorMigration).not.toMatch(
      /"(?:access_token|refresh_token)" text/,
    )
  })

  it('stores source overlaps and an explicit authority decision', () => {
    expect(reconciliationMigration).toMatch(
      /CREATE TABLE "reconciliation_conflicts"[\s\S]*"identity_key" text NOT NULL[\s\S]*"sources" jsonb NOT NULL[\s\S]*"authority_source" text[\s\S]*"details" jsonb NOT NULL/,
    )
    expect(reconciliationMigration).toMatch(
      /reconciliation_conflicts_location_identity_idx/,
    )
    expect(reconciliationMigration).toMatch(
      /reconciliation_conflicts_status_check[\s\S]*'unresolved', 'resolved'/,
    )
  })
})
