ALTER TABLE "event_outbox" ADD COLUMN "processing_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_outbox" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_outbox" ADD COLUMN "last_error" text;