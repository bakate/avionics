DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flight_inventory' AND column_name='origin') THEN
    ALTER TABLE "flight_inventory" ADD COLUMN "origin" varchar(3) NOT NULL DEFAULT 'XXX';
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flight_inventory' AND column_name='destination') THEN
    ALTER TABLE "flight_inventory" ADD COLUMN "destination" varchar(3) NOT NULL DEFAULT 'XXX';
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flight_inventory' AND column_name='flight_number') THEN
    ALTER TABLE "flight_inventory" ADD COLUMN "flight_number" varchar(10);
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flight_inventory' AND column_name='departure_time') THEN
    ALTER TABLE "flight_inventory" ADD COLUMN "departure_time" timestamp with time zone;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flight_inventory' AND column_name='arrival_time') THEN
    ALTER TABLE "flight_inventory" ADD COLUMN "arrival_time" timestamp with time zone;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flight_inventory' AND column_name='duration_minutes') THEN
    ALTER TABLE "flight_inventory" ADD COLUMN "duration_minutes" integer;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flight_inventory' AND column_name='stops') THEN
    ALTER TABLE "flight_inventory" ADD COLUMN "stops" integer DEFAULT 0;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flight_inventory' AND column_name='last_updated') THEN
    ALTER TABLE "flight_inventory" ADD COLUMN "last_updated" timestamp DEFAULT now() NOT NULL;
  END IF;
END $$;
