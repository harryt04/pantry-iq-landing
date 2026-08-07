import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  foreignKey,
} from 'drizzle-orm/pg-core'
import { locations } from './locations'

export const csvUploads = pgTable(
  'csv_uploads',
  {
    id: uuid().primaryKey().defaultRandom(),
    locationId: uuid('locationId').notNull(),
    filename: text().notNull(),
    importType: text('importType').notNull().default('transactions'),
    rowCount: integer('rowCount'),
    status: text().notNull().default('pending'),
    errorDetails: text('errorDetails'),
    fieldMapping: text('fieldMapping'),
    uploadedAt: timestamp('uploadedAt').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locations.id],
      name: 'csv_uploads_location_id_fk',
    }).onDelete('cascade'),
  ],
)
