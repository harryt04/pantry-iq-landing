import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  foreignKey,
  index,
} from 'drizzle-orm/pg-core'
import { locations } from './locations'

export const recommendations = pgTable(
  'recommendations',
  {
    id: uuid().primaryKey().defaultRandom(),
    locationId: uuid('locationId').notNull(),
    item: text().notNull(),
    type: text().notNull(),
    observation: text().notNull(),
    financialImpact: numeric('financialImpact'),
    prediction: text(),
    suggestedAction: text('suggestedAction').notNull(),
    impactScore: integer('impactScore').notNull(),
    urgencyScore: integer('urgencyScore').notNull(),
    confidenceScore: integer('confidenceScore').notNull(),
    rankScore: numeric('rankScore').notNull(),
    evidence: text().notNull(),
    status: text().notNull().default('active'),
    generatedAt: timestamp('generatedAt').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locations.id],
      name: 'recommendations_location_id_fk',
    }).onDelete('cascade'),
    index('recommendations_location_id_generated_at_idx').on(
      table.locationId,
      table.generatedAt,
    ),
  ],
)
