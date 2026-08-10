CREATE TABLE "external_signal_fetches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"source" text NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"status" text NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"cost_micros" numeric DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_signal_fetches_status_check" CHECK ("external_signal_fetches"."status" in ('succeeded', 'failed')),
	CONSTRAINT "external_signal_fetches_non_negative_check" CHECK ("external_signal_fetches"."row_count" >= 0 and "external_signal_fetches"."cost_micros" >= 0)
);
--> statement-breakpoint
CREATE TABLE "external_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"fetch_id" uuid,
	"kind" text NOT NULL,
	"business_date" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"feature" text NOT NULL,
	"condition" text NOT NULL,
	"value" numeric NOT NULL,
	"raw_data" jsonb NOT NULL,
	"source_url" text,
	"retrieved_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_signals_kind_check" CHECK ("external_signals"."kind" in ('weather', 'event')),
	CONSTRAINT "external_signals_status_check" CHECK ("external_signals"."status" in ('observed', 'forecast')),
	CONSTRAINT "external_signals_valid_period_check" CHECK ("external_signals"."valid_to" >= "external_signals"."valid_from")
);
--> statement-breakpoint
ALTER TABLE "external_signal_fetches" ADD CONSTRAINT "external_signal_fetches_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_signals" ADD CONSTRAINT "external_signals_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_signals" ADD CONSTRAINT "external_signals_fetch_id_external_signal_fetches_id_fk" FOREIGN KEY ("fetch_id") REFERENCES "public"."external_signal_fetches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "external_signal_fetches_location_requested_at_idx" ON "external_signal_fetches" USING btree ("location_id","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "external_signals_location_source_external_feature_idx" ON "external_signals" USING btree ("location_id","source","external_id","feature");--> statement-breakpoint
CREATE INDEX "external_signals_location_date_idx" ON "external_signals" USING btree ("location_id","business_date");--> statement-breakpoint
CREATE INDEX "external_signals_location_kind_date_idx" ON "external_signals" USING btree ("location_id","kind","business_date");