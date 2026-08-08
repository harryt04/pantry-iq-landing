ALTER TABLE "csv_upload_history" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "csv_upload_history" ADD COLUMN "status" text DEFAULT 'imported' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "csv_upload_history_storage_key_idx" ON "csv_upload_history" USING btree ("storage_key");--> statement-breakpoint
ALTER TABLE "csv_upload_history" ADD CONSTRAINT "csv_upload_history_status_check" CHECK ("status" in ('uploaded', 'imported'));
