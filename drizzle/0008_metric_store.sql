CREATE TABLE "metric_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"status" text NOT NULL,
	"input_window_start" timestamp with time zone NOT NULL,
	"input_window_end" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metric_runs_status_check" CHECK (status in ('running', 'succeeded', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "metric_runs" ADD CONSTRAINT "metric_runs_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "metric_runs_location_started_at_idx" ON "metric_runs" USING btree ("location_id","started_at");
--> statement-breakpoint
CREATE INDEX "metric_runs_location_status_idx" ON "metric_runs" USING btree ("location_id","status");
--> statement-breakpoint
CREATE TABLE "metric_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"metric_key" text NOT NULL,
	"status" text NOT NULL,
	"value" numeric,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metric_results_status_check" CHECK (status in ('calculated', 'cannot-calculate'))
);
--> statement-breakpoint
ALTER TABLE "metric_results" ADD CONSTRAINT "metric_results_run_id_metric_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."metric_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "metric_results" ADD CONSTRAINT "metric_results_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "metric_results" ADD CONSTRAINT "metric_results_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "metric_results_run_item_key_idx" ON "metric_results" USING btree ("run_id","inventory_item_id","metric_key");
--> statement-breakpoint
CREATE INDEX "metric_results_location_item_key_idx" ON "metric_results" USING btree ("location_id","inventory_item_id","metric_key");
--> statement-breakpoint
CREATE TABLE "metric_rollups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"metric_key" text NOT NULL,
	"status" text NOT NULL,
	"value" numeric,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metric_rollups_status_check" CHECK (status in ('calculated', 'cannot-calculate'))
);
--> statement-breakpoint
ALTER TABLE "metric_rollups" ADD CONSTRAINT "metric_rollups_run_id_metric_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."metric_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "metric_rollups" ADD CONSTRAINT "metric_rollups_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "metric_rollups_run_key_idx" ON "metric_rollups" USING btree ("run_id","metric_key");
--> statement-breakpoint
CREATE INDEX "metric_rollups_location_key_idx" ON "metric_rollups" USING btree ("location_id","metric_key");
