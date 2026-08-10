ALTER TABLE "inventory_items"
ADD COLUMN "menu_price" numeric;
--> statement-breakpoint
CREATE TABLE "recipe_cost_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"calculated_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"batch_cost" numeric,
	"cost_per_output" numeric,
	"menu_price" numeric,
	"plate_margin" numeric,
	"food_cost_percentage" numeric,
	"evidence" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_cost_history_status_check" CHECK ("status" in ('empty', 'partial', 'complete'))
);
--> statement-breakpoint
ALTER TABLE "recipe_cost_history" ADD CONSTRAINT "recipe_cost_history_location_id_locations_id_fk"
FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipe_cost_history" ADD CONSTRAINT "recipe_cost_history_recipe_id_recipes_id_fk"
FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "recipe_cost_history_location_recipe_calculated_idx"
ON "recipe_cost_history" USING btree ("location_id", "recipe_id", "calculated_at");
