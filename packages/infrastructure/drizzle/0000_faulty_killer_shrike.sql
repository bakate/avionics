CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" varchar(50) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"operation" varchar(20) NOT NULL,
	"changes" jsonb,
	"user_id" varchar(100),
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pnr_code" varchar(6) NOT NULL,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "bookings_pnr_code_unique" UNIQUE("pnr_code")
);
--> statement-breakpoint
CREATE TABLE "event_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"aggregate_id" varchar(100),
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "flight_inventory" (
	"flight_id" varchar(50) PRIMARY KEY NOT NULL,
	"economy_total" integer NOT NULL,
	"economy_available" integer NOT NULL,
	"business_total" integer NOT NULL,
	"business_available" integer NOT NULL,
	"first_total" integer NOT NULL,
	"first_available" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "chk_economy_available" CHECK ("flight_inventory"."economy_available" >= 0 AND "flight_inventory"."economy_available" <= "flight_inventory"."economy_total"),
	CONSTRAINT "chk_business_available" CHECK ("flight_inventory"."business_available" >= 0 AND "flight_inventory"."business_available" <= "flight_inventory"."business_total"),
	CONSTRAINT "chk_first_available" CHECK ("flight_inventory"."first_available" >= 0 AND "flight_inventory"."first_available" <= "flight_inventory"."first_total")
);
--> statement-breakpoint
CREATE TABLE "passengers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"date_of_birth" date,
	"gender" varchar(20),
	"type" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"flight_id" varchar(50) NOT NULL,
	"cabin_class" varchar(20) NOT NULL,
	"price_amount" numeric(10, 2) NOT NULL,
	"price_currency" varchar(3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bookings_pnr" ON "bookings" USING btree ("pnr_code");--> statement-breakpoint
CREATE INDEX "idx_bookings_status" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_outbox_unpublished" ON "event_outbox" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_passengers_booking" ON "passengers" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_segments_booking" ON "segments" USING btree ("booking_id");