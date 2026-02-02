import { sql } from "drizzle-orm";
import {
  check,
  date,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// 1. Flight Inventory (Aggregate Root with Optimistic Locking)
export const flightInventory = pgTable(
  "flight_inventory",
  {
    flightId: varchar("flight_id", { length: 50 }).primaryKey(),

    // Capacity & Availability
    economyTotal: integer("economy_total").notNull(),
    economyAvailable: integer("economy_available").notNull(),
    businessTotal: integer("business_total").notNull(),
    businessAvailable: integer("business_available").notNull(),
    firstTotal: integer("first_total").notNull(),
    firstAvailable: integer("first_available").notNull(),

    // Optimistic Locking
    version: integer("version").notNull().default(1),
  },
  (table) => [
    // Constraints
    check(
      "chk_economy_available",
      sql`${table.economyAvailable} >= 0 AND ${table.economyAvailable} <= ${table.economyTotal}`,
    ),
    check(
      "chk_business_available",
      sql`${table.businessAvailable} >= 0 AND ${table.businessAvailable} <= ${table.businessTotal}`,
    ),
    check(
      "chk_first_available",
      sql`${table.firstAvailable} >= 0 AND ${table.firstAvailable} <= ${table.firstTotal}`,
    ),
  ],
);

// 2. Bookings (Aggregate Root with Optimistic Locking)
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey(),
    pnrCode: varchar("pnr_code", { length: 6 }).notNull().unique(),
    status: varchar("status", { length: 20 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at"),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("idx_bookings_pnr").on(table.pnrCode),
    index("idx_bookings_status").on(table.status),
  ],
);

// 3. Passengers (Entity within Booking)
export const passengers = pgTable(
  "passengers",
  {
    id: uuid("id").primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    dateOfBirth: date("date_of_birth"),
    gender: varchar("gender", { length: 20 }),
    type: varchar("type", { length: 20 }),
  },
  (table) => [index("idx_passengers_booking").on(table.bookingId)],
);

// 4. Segments (Value Object / Entity within Booking)
export const segments = pgTable(
  "segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    flightId: varchar("flight_id", { length: 50 }).notNull(),
    cabinClass: varchar("cabin_class", { length: 20 }).notNull(),
    priceAmount: decimal("price_amount", { precision: 10, scale: 2 }).notNull(),
    priceCurrency: varchar("price_currency", { length: 3 }).notNull(),
  },
  (table) => [index("idx_segments_booking").on(table.bookingId)],
);

// 5. Transactional Outbox (Events)
export const eventOutbox = pgTable(
  "event_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    aggregateId: varchar("aggregate_id", { length: 100 }),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    publishedAt: timestamp("published_at"),
  },
  (table) => [
    // Index for unpublished events (partial index will be added in migration)
    index("idx_outbox_unpublished").on(table.createdAt),
  ],
);

// 6. Audit Log
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  aggregateType: varchar("aggregate_type", { length: 50 }).notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  operation: varchar("operation", { length: 20 }).notNull(),
  changes: jsonb("changes"),
  userId: varchar("user_id", { length: 100 }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});
