CREATE TABLE "observability_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"location_id" uuid,
	"event_type" text NOT NULL,
	"status" text NOT NULL,
	"reference_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"duration_ms" integer,
	"rows_imported" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_micros" numeric,
	"currency" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "observability_events_type_check" CHECK ("observability_events"."event_type" in ('precompute', 'import', 'llm-query')),
	CONSTRAINT "observability_events_status_check" CHECK ("observability_events"."status" in ('succeeded', 'failed')),
	CONSTRAINT "observability_events_non_negative_check" CHECK (("observability_events"."duration_ms" is null or "observability_events"."duration_ms" >= 0)
        and ("observability_events"."rows_imported" is null or "observability_events"."rows_imported" >= 0)
        and ("observability_events"."input_tokens" is null or "observability_events"."input_tokens" >= 0)
        and ("observability_events"."output_tokens" is null or "observability_events"."output_tokens" >= 0)
        and ("observability_events"."cost_micros" is null or "observability_events"."cost_micros" >= 0))
);
--> statement-breakpoint
ALTER TABLE "observability_events" ADD CONSTRAINT "observability_events_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observability_events" ADD CONSTRAINT "observability_events_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "observability_events_type_reference_idx" ON "observability_events" USING btree ("event_type","reference_id");--> statement-breakpoint
CREATE INDEX "observability_events_location_occurred_at_idx" ON "observability_events" USING btree ("location_id","occurred_at");--> statement-breakpoint
CREATE INDEX "observability_events_account_occurred_at_idx" ON "observability_events" USING btree ("account_id","occurred_at");