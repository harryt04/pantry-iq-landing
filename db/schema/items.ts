import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  foreignKey,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { locations } from './locations'

export const items = pgTable(
  'items',
  {
    id: uuid().primaryKey().defaultRandom(),
    locationId: uuid('locationId').notNull(),
    name: text().notNull(),
    category: text().notNull().default('other'),
    shelfLifeDays: integer('shelfLifeDays'),
    unitCost: numeric('unitCost'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locations.id],
      name: 'items_location_id_fk',
    }).onDelete('cascade'),
    uniqueIndex('items_location_id_name_unique').on(
      table.locationId,
      table.name,
    ),
  ],
)
