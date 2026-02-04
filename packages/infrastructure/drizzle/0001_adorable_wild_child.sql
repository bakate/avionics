ALTER TABLE "flight_inventory" ADD COLUMN "economy_price_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "flight_inventory" ADD COLUMN "economy_price_currency" varchar(3) DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "flight_inventory" ADD COLUMN "business_price_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "flight_inventory" ADD COLUMN "business_price_currency" varchar(3) DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "flight_inventory" ADD COLUMN "first_price_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "flight_inventory" ADD COLUMN "first_price_currency" varchar(3) DEFAULT 'EUR' NOT NULL;