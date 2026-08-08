ALTER TABLE "inventory_items"
ADD COLUMN "item_type" text DEFAULT 'ingredient' NOT NULL;
--> statement-breakpoint
ALTER TABLE "inventory_items"
ADD CONSTRAINT "inventory_items_item_type_check"
CHECK ("item_type" IN ('ingredient', 'menu_item'));
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"name" text NOT NULL,
	"output_quantity" numeric DEFAULT '1' NOT NULL,
	"output_unit" text NOT NULL,
	"yield_factor" numeric DEFAULT '1' NOT NULL,
	"waste_factor" numeric DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipes_positive_output_quantity_check" CHECK ("output_quantity" > 0),
	CONSTRAINT "recipes_positive_yield_factor_check" CHECK ("yield_factor" > 0),
	CONSTRAINT "recipes_waste_factor_range_check" CHECK ("waste_factor" >= 0 AND "waste_factor" < 1)
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"ingredient_item_id" uuid,
	"sub_recipe_id" uuid,
	"quantity" numeric NOT NULL,
	"unit" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_ingredients_exactly_one_target_check" CHECK (("ingredient_item_id" IS NOT NULL AND "sub_recipe_id" IS NULL) OR ("ingredient_item_id" IS NULL AND "sub_recipe_id" IS NOT NULL)),
	CONSTRAINT "recipe_ingredients_positive_quantity_check" CHECK ("quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "item_unit_conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"from_unit" text NOT NULL,
	"to_unit" text NOT NULL,
	"factor" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_unit_conversions_positive_factor_check" CHECK ("factor" > 0)
);
--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_location_id_locations_id_fk"
FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_menu_item_id_inventory_items_id_fk"
FOREIGN KEY ("menu_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk"
FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_item_id_inventory_items_id_fk"
FOREIGN KEY ("ingredient_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_sub_recipe_id_recipes_id_fk"
FOREIGN KEY ("sub_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "item_unit_conversions" ADD CONSTRAINT "item_unit_conversions_location_id_locations_id_fk"
FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "item_unit_conversions" ADD CONSTRAINT "item_unit_conversions_inventory_item_id_inventory_items_id_fk"
FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_location_menu_item_name_idx" ON "recipes" USING btree ("location_id", "menu_item_id", "name");
--> statement-breakpoint
CREATE INDEX "recipes_location_idx" ON "recipes" USING btree ("location_id");
--> statement-breakpoint
CREATE INDEX "recipe_ingredients_recipe_id_idx" ON "recipe_ingredients" USING btree ("recipe_id");
--> statement-breakpoint
CREATE INDEX "recipe_ingredients_ingredient_item_id_idx" ON "recipe_ingredients" USING btree ("ingredient_item_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "item_unit_conversions_item_units_idx" ON "item_unit_conversions" USING btree ("location_id", "inventory_item_id", "from_unit", "to_unit");
