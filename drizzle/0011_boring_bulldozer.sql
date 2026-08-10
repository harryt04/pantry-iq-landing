CREATE TABLE "reconciliation_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"record_kind" text NOT NULL,
	"conflict_type" text NOT NULL,
	"identity_key" text NOT NULL,
	"external_id" text,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"sources" jsonb NOT NULL,
	"status" text DEFAULT 'unresolved' NOT NULL,
	"authority_source" text,
	"details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reconciliation_conflicts_record_kind_check" CHECK ("record_kind" in ('transaction', 'purchase_order', 'inventory')),
	CONSTRAINT "reconciliation_conflicts_type_check" CHECK ("conflict_type" in ('external-id', 'period-overlap')),
	CONSTRAINT "reconciliation_conflicts_status_check" CHECK ("status" in ('unresolved', 'resolved')),
	CONSTRAINT "reconciliation_conflicts_period_check" CHECK ("period_end" >= "period_start")
);
--> statement-breakpoint
ALTER TABLE "reconciliation_conflicts" ADD CONSTRAINT "reconciliation_conflicts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "reconciliation_conflicts_location_identity_idx" ON "reconciliation_conflicts" USING btree ("location_id","identity_key");
--> statement-breakpoint
CREATE INDEX "reconciliation_conflicts_location_status_idx" ON "reconciliation_conflicts" USING btree ("location_id","status");
