CREATE TABLE "coupons" (
	"ticket_number" varchar(13) NOT NULL,
	"coupon_number" integer NOT NULL,
	"flight_id" varchar(50) NOT NULL,
	"seat_number" varchar(10),
	"status" varchar(20) NOT NULL,
	CONSTRAINT "coupons_ticket_number_coupon_number_pk" PRIMARY KEY("ticket_number","coupon_number")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"ticket_number" varchar(13) PRIMARY KEY NOT NULL,
	"pnr_code" varchar(6) NOT NULL,
	"status" varchar(20) NOT NULL,
	"passenger_id" uuid NOT NULL,
	"passenger_name" varchar(255) NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_ticket_number_tickets_ticket_number_fk" FOREIGN KEY ("ticket_number") REFERENCES "public"."tickets"("ticket_number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tickets_pnr" ON "tickets" USING btree ("pnr_code");