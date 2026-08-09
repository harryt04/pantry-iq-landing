CREATE TABLE "labor_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"shift_start" timestamp with time zone NOT NULL,
	"shift_end" timestamp with time zone,
	"external_id" text NOT NULL,
	"source" text NOT NULL,
	"employee_reference" text,
	"role" text NOT NULL,
	"scheduled_hours" numeric,
	"actual_hours" numeric,
	"labor_cost" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "labor_shifts_hours_present_check" CHECK ("labor_shifts"."scheduled_hours" is not null or "labor_shifts"."actual_hours" is not null),
	CONSTRAINT "labor_shifts_non_negative_hours_check" CHECK (("labor_shifts"."scheduled_hours" is null or "labor_shifts"."scheduled_hours" >= 0) and ("labor_shifts"."actual_hours" is null or "labor_shifts"."actual_hours" >= 0)),
	CONSTRAINT "labor_shifts_non_negative_cost_check" CHECK ("labor_shifts"."labor_cost" is null or "labor_shifts"."labor_cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE "labor_shifts" ADD CONSTRAINT "labor_shifts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "labor_shifts_location_shift_start_idx" ON "labor_shifts" USING btree ("location_id","shift_start");--> statement-breakpoint
CREATE INDEX "labor_shifts_location_role_idx" ON "labor_shifts" USING btree ("location_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "labor_shifts_location_source_external_id_idx" ON "labor_shifts" USING btree ("location_id","source","external_id");