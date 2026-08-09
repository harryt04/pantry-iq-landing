import { sql } from 'drizzle-orm'

import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  unique,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const createdAt = timestamp('created_at', { withTimezone: true })
  .defaultNow()
  .notNull()
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .defaultNow()
  .notNull()

export const user = pgTable(
  'user',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    companyName: text('company_name'),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    createdAt,
    updatedAt,
  },
  (table) => [unique('user_email_unique').on(table.email)],
)

export const session = pgTable(
  'session',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique('session_token_unique').on(table.token),
    index('session_user_id_idx').on(table.userId),
  ],
)

export const account = pgTable(
  'account',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    idToken: text('id_token'),
    password: text('password'),
    createdAt,
    updatedAt,
  },
  (table) => [index('account_user_id_idx').on(table.userId)],
)

export const verification = pgTable(
  'verification',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
)

export const locations = pgTable('locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address'),
  isActive: boolean('is_active').notNull().default(true),
  timezone: text('timezone').notNull().default('America/Denver'),
  businessDayBoundary: time('business_day_boundary')
    .notNull()
    .default('04:00:00'),
  createdAt,
  updatedAt,
})

export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    canonicalName: text('canonical_name').notNull(),
    displayName: text('display_name').notNull(),
    category: text('category'),
    unit: text('unit').notNull(),
    itemType: text('item_type').notNull().default('ingredient'),
    shelfLifeDays: integer('shelf_life_days'),
    costPerUnit: numeric('cost_per_unit'),
    menuPrice: numeric('menu_price'),
    parLevel: numeric('par_level'),
    isActive: boolean('is_active').notNull().default(true),
    usageCount: integer('usage_count').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex('inventory_items_location_canonical_name_idx').on(
      table.locationId,
      table.canonicalName,
    ),
    check(
      'inventory_items_item_type_check',
      sql`${table.itemType} in ('ingredient', 'menu_item')`,
    ),
  ],
)

export const recipes = pgTable(
  'recipes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    menuItemId: uuid('menu_item_id')
      .notNull()
      .references(() => inventoryItems.id),
    name: text('name').notNull(),
    outputQuantity: numeric('output_quantity').notNull().default('1'),
    outputUnit: text('output_unit').notNull(),
    yieldFactor: numeric('yield_factor').notNull().default('1'),
    wasteFactor: numeric('waste_factor').notNull().default('0'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex('recipes_location_menu_item_name_idx').on(
      table.locationId,
      table.menuItemId,
      table.name,
    ),
    index('recipes_location_idx').on(table.locationId),
    check(
      'recipes_positive_output_quantity_check',
      sql`${table.outputQuantity} > 0`,
    ),
    check('recipes_positive_yield_factor_check', sql`${table.yieldFactor} > 0`),
    check(
      'recipes_waste_factor_range_check',
      sql`${table.wasteFactor} >= 0 and ${table.wasteFactor} < 1`,
    ),
  ],
)

export const recipeIngredients = pgTable(
  'recipe_ingredients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    ingredientItemId: uuid('ingredient_item_id').references(
      () => inventoryItems.id,
    ),
    subRecipeId: uuid('sub_recipe_id').references(() => recipes.id),
    quantity: numeric('quantity').notNull(),
    unit: text('unit').notNull(),
    createdAt,
  },
  (table) => [
    index('recipe_ingredients_recipe_id_idx').on(table.recipeId),
    index('recipe_ingredients_ingredient_item_id_idx').on(
      table.ingredientItemId,
    ),
    check(
      'recipe_ingredients_exactly_one_target_check',
      sql`(
        (${table.ingredientItemId} is not null and ${table.subRecipeId} is null)
        or
        (${table.ingredientItemId} is null and ${table.subRecipeId} is not null)
      )`,
    ),
    check(
      'recipe_ingredients_positive_quantity_check',
      sql`${table.quantity} > 0`,
    ),
  ],
)

export const itemUnitConversions = pgTable(
  'item_unit_conversions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'cascade' }),
    fromUnit: text('from_unit').notNull(),
    toUnit: text('to_unit').notNull(),
    factor: numeric('factor').notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex('item_unit_conversions_item_units_idx').on(
      table.locationId,
      table.inventoryItemId,
      table.fromUnit,
      table.toUnit,
    ),
    check(
      'item_unit_conversions_positive_factor_check',
      sql`${table.factor} > 0`,
    ),
  ],
)

export const recipeCostHistory = pgTable(
  'recipe_cost_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull(),
    status: text('status').notNull(),
    batchCost: numeric('batch_cost'),
    costPerOutput: numeric('cost_per_output'),
    menuPrice: numeric('menu_price'),
    plateMargin: numeric('plate_margin'),
    foodCostPercentage: numeric('food_cost_percentage'),
    evidence: jsonb('evidence').notNull(),
    createdAt,
  },
  (table) => [
    index('recipe_cost_history_location_recipe_calculated_idx').on(
      table.locationId,
      table.recipeId,
      table.calculatedAt,
    ),
    check(
      'recipe_cost_history_status_check',
      sql`${table.status} in ('empty', 'partial', 'complete')`,
    ),
  ],
)

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    transactedAt: timestamp('transacted_at', { withTimezone: true }).notNull(),
    externalId: text('external_id').notNull(),
    source: text('source').notNull(),
    menuItemId: uuid('menu_item_id').references(() => inventoryItems.id),
    rawItemName: text('raw_item_name').notNull(),
    category: text('category'),
    qty: numeric('qty').notNull(),
    unitPrice: numeric('unit_price').notNull(),
    totalRevenue: numeric('total_revenue').notNull(),
    totalCost: numeric('total_cost'),
    grossMargin: numeric('gross_margin'),
    createdAt,
  },
  (table) => [
    index('transactions_location_transacted_at_idx').on(
      table.locationId,
      table.transactedAt,
    ),
    index('transactions_location_menu_item_idx').on(
      table.locationId,
      table.menuItemId,
    ),
    uniqueIndex('transactions_location_source_external_id_idx').on(
      table.locationId,
      table.source,
      table.externalId,
    ),
  ],
)

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    orderedAt: timestamp('ordered_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    externalId: text('external_id'),
    source: text('source').notNull(),
    supplierName: text('supplier_name'),
    createdAt,
  },
  (table) => [
    uniqueIndex('purchase_orders_location_source_external_id_idx').on(
      table.locationId,
      table.source,
      table.externalId,
    ),
  ],
)

export const purchaseOrderItems = pgTable(
  'purchase_order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    inventoryItemId: uuid('inventory_item_id').references(
      () => inventoryItems.id,
    ),
    rawItemName: text('raw_item_name').notNull(),
    qty: numeric('qty').notNull(),
    unitCost: numeric('unit_cost').notNull(),
    totalCost: numeric('total_cost').notNull(),
    createdAt,
  },
  (table) => [
    index('purchase_order_items_location_inventory_item_idx').on(
      table.locationId,
      table.inventoryItemId,
    ),
  ],
)

export const inventorySnapshots = pgTable(
  'inventory_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id),
    countedAt: timestamp('counted_at', { withTimezone: true }).notNull(),
    qty: numeric('qty').notNull(),
    source: text('source').notNull(),
    createdAt,
  },
  (table) => [
    index('inventory_snapshots_location_counted_at_idx').on(
      table.locationId,
      table.countedAt,
    ),
  ],
)

export const csvUploadHistory = pgTable(
  'csv_upload_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    filename: text('filename').notNull(),
    source: text('source').notNull(),
    rowsImported: integer('rows_imported').notNull(),
    mappingUsed: jsonb('mapping_used').notNull(),
    itemResolution: jsonb('item_resolution'),
    unmatchedItems: jsonb('unmatched_items'),
    storageKey: text('storage_key'),
    status: text('status').notNull().default('imported'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex('csv_upload_history_storage_key_idx').on(table.storageKey),
    check(
      'csv_upload_history_status_check',
      sql`${table.status} in ('uploaded', 'imported')`,
    ),
  ],
)

export const metricRuns = pgTable(
  'metric_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    inputWindowStart: timestamp('input_window_start', {
      withTimezone: true,
    }).notNull(),
    inputWindowEnd: timestamp('input_window_end', {
      withTimezone: true,
    }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    error: text('error'),
    createdAt,
  },
  (table) => [
    index('metric_runs_location_started_at_idx').on(
      table.locationId,
      table.startedAt,
    ),
    index('metric_runs_location_status_idx').on(table.locationId, table.status),
    check(
      'metric_runs_status_check',
      sql`${table.status} in ('running', 'succeeded', 'failed')`,
    ),
  ],
)

export const metricResults = pgTable(
  'metric_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => metricRuns.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'cascade' }),
    metricKey: text('metric_key').notNull(),
    status: text('status').notNull(),
    value: numeric('value'),
    result: jsonb('result').notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex('metric_results_run_item_key_idx').on(
      table.runId,
      table.inventoryItemId,
      table.metricKey,
    ),
    index('metric_results_location_item_key_idx').on(
      table.locationId,
      table.inventoryItemId,
      table.metricKey,
    ),
    check(
      'metric_results_status_check',
      sql`${table.status} in ('calculated', 'cannot-calculate')`,
    ),
  ],
)

export const metricRollups = pgTable(
  'metric_rollups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => metricRuns.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    metricKey: text('metric_key').notNull(),
    status: text('status').notNull(),
    value: numeric('value'),
    result: jsonb('result').notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex('metric_rollups_run_key_idx').on(table.runId, table.metricKey),
    index('metric_rollups_location_key_idx').on(
      table.locationId,
      table.metricKey,
    ),
    check(
      'metric_rollups_status_check',
      sql`${table.status} in ('calculated', 'cannot-calculate')`,
    ),
  ],
)
