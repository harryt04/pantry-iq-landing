CREATE TABLE "csv_upload_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"source" text NOT NULL,
	"rows_imported" integer NOT NULL,
	"mapping_used" jsonb NOT NULL,
	"unmatched_items" jsonb,
	"uploaded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"canonical_name" text NOT NULL,
	"display_name" text NOT NULL,
	"category" text,
	"unit" text NOT NULL,
	"shelf_life_days" integer,
	"cost_per_unit" numeric,
	"par_level" numeric,
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"counted_at" timestamp with time zone NOT NULL,
	"qty" numeric NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"timezone" text DEFAULT 'America/Denver' NOT NULL,
	"business_day_boundary" time DEFAULT '04:00:00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"inventory_item_id" uuid,
	"raw_item_name" text NOT NULL,
	"qty" numeric NOT NULL,
	"unit_cost" numeric NOT NULL,
	"total_cost" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"ordered_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone,
	"external_id" text,
	"source" text NOT NULL,
	"supplier_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"transacted_at" timestamp with time zone NOT NULL,
	"external_id" text NOT NULL,
	"source" text NOT NULL,
	"menu_item_id" uuid,
	"raw_item_name" text NOT NULL,
	"category" text,
	"qty" numeric NOT NULL,
	"unit_price" numeric NOT NULL,
	"total_revenue" numeric NOT NULL,
	"total_cost" numeric,
	"gross_margin" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "csv_upload_history" ADD CONSTRAINT "csv_upload_history_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_snapshots" ADD CONSTRAINT "inventory_snapshots_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_snapshots" ADD CONSTRAINT "inventory_snapshots_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_menu_item_id_inventory_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_items_location_canonical_name_idx" ON "inventory_items" USING btree ("location_id","canonical_name");--> statement-breakpoint
CREATE INDEX "inventory_snapshots_location_counted_at_idx" ON "inventory_snapshots" USING btree ("location_id","counted_at");--> statement-breakpoint
CREATE INDEX "purchase_order_items_location_inventory_item_idx" ON "purchase_order_items" USING btree ("location_id","inventory_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_location_source_external_id_idx" ON "purchase_orders" USING btree ("location_id","source","external_id");--> statement-breakpoint
CREATE INDEX "transactions_location_transacted_at_idx" ON "transactions" USING btree ("location_id","transacted_at");--> statement-breakpoint
CREATE INDEX "transactions_location_menu_item_idx" ON "transactions" USING btree ("location_id","menu_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_location_source_external_id_idx" ON "transactions" USING btree ("location_id","source","external_id");