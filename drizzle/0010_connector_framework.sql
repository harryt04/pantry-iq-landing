CREATE TABLE "connector_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_account_id" text,
	"status" text DEFAULT 'authorizing' NOT NULL,
	"encrypted_credentials" text NOT NULL,
	"access_token_expires_at" timestamp with time zone,
	"sync_cursor" text,
	"backfill_cursor" text,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"connected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connector_connections_status_check" CHECK (status in ('authorizing', 'connected', 'syncing', 'failed', 'revoked', 'disconnected'))
);
--> statement-breakpoint
ALTER TABLE "connector_connections" ADD CONSTRAINT "connector_connections_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "connector_connections_location_provider_idx" ON "connector_connections" USING btree ("location_id","provider");
--> statement-breakpoint
CREATE INDEX "connector_connections_status_idx" ON "connector_connections" USING btree ("status");
--> statement-breakpoint
CREATE TABLE "connector_oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"state_hash" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"return_to" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connector_oauth_states" ADD CONSTRAINT "connector_oauth_states_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "connector_oauth_states_state_hash_idx" ON "connector_oauth_states" USING btree ("state_hash");
--> statement-breakpoint
CREATE INDEX "connector_oauth_states_expiry_idx" ON "connector_oauth_states" USING btree ("expires_at");
--> statement-breakpoint
CREATE TABLE "connector_webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"provider_event_id" text NOT NULL,
	"payload_hash" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connector_webhook_deliveries" ADD CONSTRAINT "connector_webhook_deliveries_connection_id_connector_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connector_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "connector_webhook_deliveries_event_idx" ON "connector_webhook_deliveries" USING btree ("connection_id","provider_event_id");
--> statement-breakpoint
CREATE INDEX "connector_webhook_deliveries_received_idx" ON "connector_webhook_deliveries" USING btree ("connection_id","received_at");
