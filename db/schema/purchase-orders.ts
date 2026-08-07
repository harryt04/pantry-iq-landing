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

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: uuid().primaryKey().defaultRandom(),
    locationId: uuid('locationId').notNull(),
    purchaseDate: text('purchaseDate').notNull(),
    item: text().notNull(),
    qty: numeric().notNull(),
    unitCost: numeric('unitCost'),
    totalCost: numeric('totalCost'),
    supplier: text(),
    deliveryDate: text('deliveryDate'),
    source: text().notNull(),
    sourceId: text('sourceId'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locations.id],
      name: 'purchase_orders_location_id_fk',
    }).onDelete('cascade'),
    index('purchase_orders_location_id_date_idx').on(
      table.locationId,
      table.purchaseDate,
    ),
  ],
)
