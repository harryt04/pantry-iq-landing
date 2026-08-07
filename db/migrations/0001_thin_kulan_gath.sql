ALTER TABLE "csv_uploads"
  ADD COLUMN IF NOT EXISTS "importType" text DEFAULT 'transactions' NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "locationId" uuid NOT NULL,
  "name" text NOT NULL,
  "category" text DEFAULT 'other' NOT NULL,
  "shelfLifeDays" integer,
  "unitCost" numeric,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "purchase_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "locationId" uuid NOT NULL,
  "purchaseDate" text NOT NULL,
  "item" text NOT NULL,
  "qty" numeric NOT NULL,
  "unitCost" numeric,
  "totalCost" numeric,
  "supplier" text,
  "deliveryDate" text,
  "source" text NOT NULL,
  "sourceId" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "inventory_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "locationId" uuid NOT NULL,
  "snapshotDate" text NOT NULL,
  "item" text NOT NULL,
  "qtyOnHand" numeric NOT NULL,
  "snapshotType" text DEFAULT 'count' NOT NULL,
  "source" text NOT NULL,
  "sourceId" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "recommendations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "locationId" uuid NOT NULL,
  "item" text NOT NULL,
  "type" text NOT NULL,
  "observation" text NOT NULL,
  "financialImpact" numeric,
  "prediction" text,
  "suggestedAction" text NOT NULL,
  "impactScore" integer NOT NULL,
  "urgencyScore" integer NOT NULL,
  "confidenceScore" integer NOT NULL,
  "rankScore" numeric NOT NULL,
  "evidence" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "generatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "locationId" uuid NOT NULL,
  "entityType" text NOT NULL,
  "entityId" text NOT NULL,
  "action" text NOT NULL,
  "actorType" text NOT NULL,
  "actorId" text,
  "priorValue" text,
  "newValue" text,
  "source" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "items"
    ADD CONSTRAINT "items_location_id_fk"
    FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "purchase_orders"
    ADD CONSTRAINT "purchase_orders_location_id_fk"
    FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inventory_snapshots"
    ADD CONSTRAINT "inventory_snapshots_location_id_fk"
    FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "recommendations"
    ADD CONSTRAINT "recommendations_location_id_fk"
    FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "audit_events"
    ADD CONSTRAINT "audit_events_location_id_fk"
    FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "items_location_id_name_unique"
  ON "items" ("locationId", "name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_location_id_date_idx"
  ON "purchase_orders" ("locationId", "purchaseDate");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_snapshots_location_id_date_idx"
  ON "inventory_snapshots" ("locationId", "snapshotDate");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recommendations_location_id_generated_at_idx"
  ON "recommendations" ("locationId", "generatedAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_location_id_created_at_idx"
  ON "audit_events" ("locationId", "createdAt");
