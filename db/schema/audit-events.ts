import {
  pgTable,
  uuid,
  text,
  timestamp,
  foreignKey,
  index,
} from 'drizzle-orm/pg-core'
import { locations } from './locations'

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    locationId: uuid('locationId').notNull(),
    entityType: text('entityType').notNull(),
    entityId: text('entityId').notNull(),
    action: text().notNull(),
    actorType: text('actorType').notNull(),
    actorId: text('actorId'),
    priorValue: text('priorValue'),
    newValue: text('newValue'),
    source: text().notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locations.id],
      name: 'audit_events_location_id_fk',
    }).onDelete('cascade'),
    index('audit_events_location_id_created_at_idx').on(
      table.locationId,
      table.createdAt,
    ),
  ],
)
