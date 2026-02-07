DROP INDEX "idx_outbox_unpublished";--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN "seat_number" varchar(10);--> statement-breakpoint
CREATE INDEX "idx_outbox_unpublished" ON "event_outbox" USING btree ("created_at") WHERE "event_outbox"."published_at" IS NULL;