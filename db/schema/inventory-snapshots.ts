import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  foreignKey,
  index,
} from 'drizzle-orm/pg-core'
import { locations } from './locations'

export const inventorySnapshots = pgTable(
  'inventory_snapshots',
  {
    id: uuid().primaryKey().defaultRandom(),
    locationId: uuid('locationId').notNull(),
    snapshotDate: text('snapshotDate').notNull(),
    item: text().notNull(),
    qtyOnHand: numeric('qtyOnHand').notNull(),
    snapshotType: text('snapshotType').notNull().default('count'),
    source: text().notNull(),
    sourceId: text('sourceId'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locations.id],
      name: 'inventory_snapshots_location_id_fk',
    }).onDelete('cascade'),
    index('inventory_snapshots_location_id_date_idx').on(
      table.locationId,
      table.snapshotDate,
    ),
  ],
)
