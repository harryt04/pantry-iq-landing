import {
  boolean,
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
    shelfLifeDays: integer('shelf_life_days'),
    costPerUnit: numeric('cost_per_unit'),
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

export const csvUploadHistory = pgTable('csv_upload_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id),
  filename: text('filename').notNull(),
  source: text('source').notNull(),
  rowsImported: integer('rows_imported').notNull(),
  mappingUsed: jsonb('mapping_used').notNull(),
  unmatchedItems: jsonb('unmatched_items'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull(),
  createdAt,
})
