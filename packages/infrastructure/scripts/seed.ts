#!/usr/bin/env tsx
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SqlClient } from "@effect/sql";
import { InventoryRepository } from "@workspace/application/inventory.repository";
import { FlightInventory, SeatBucket } from "@workspace/domain/inventory";
import { AirportCodeSchema, FlightId, Money } from "@workspace/domain/kernel";
import * as dotenv from "dotenv";
import { Effect, Layer, Option, Schema } from "effect";
import { ConnectionPoolLive } from "../src/db/connection.js";
import { PostgresInventoryRepositoryLive } from "../src/repositories/postgres-inventory.repository.js";

// ---------------------------------------------------------------------------
// Environment & Safety
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.test") });

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

const MainLayer = PostgresInventoryRepositoryLive.pipe(
  Layer.provideMerge(ConnectionPoolLive),
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlightParams {
  flightId: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: Date;
  /** Duration in minutes — used to derive arrivalTime. Defaults to 120. */
  durationMinutes?: number;
  stops?: number;
  economyPrice: number;
  businessPrice: number;
  firstPrice: number;
  economyTotal?: number;
  businessTotal?: number;
  firstTotal?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createFlight(params: FlightParams): FlightInventory {
  const {
    flightId,
    flightNumber,
    origin,
    destination,
    departureTime,
    durationMinutes = 120,
    stops = 0,
    economyPrice,
    businessPrice,
    firstPrice,
    economyTotal = 150,
    businessTotal = 30,
    firstTotal = 12,
  } = params;

  const arrivalTime = new Date(
    departureTime.getTime() + durationMinutes * 60 * 1000,
  );

  return new FlightInventory({
    flightId: Schema.decodeSync(FlightId)(flightId),
    origin: Schema.decodeSync(AirportCodeSchema)(origin),
    destination: Schema.decodeSync(AirportCodeSchema)(destination),
    flightNumber: Option.some(flightNumber),
    departureTime: Option.some(departureTime),
    arrivalTime: Option.some(arrivalTime),
    durationMinutes: Option.some(durationMinutes),
    stops: Option.some(stops),
    availability: {
      economy: new SeatBucket({
        capacity: economyTotal,
        available: economyTotal,
        price: Money.of(economyPrice, "EUR"),
      }),
      business: new SeatBucket({
        capacity: businessTotal,
        available: businessTotal,
        price: Money.of(businessPrice, "EUR"),
      }),
      first: new SeatBucket({
        capacity: firstTotal,
        available: firstTotal,
        price: Money.of(firstPrice, "EUR"),
      }),
    },
    version: 0,
    domainEvents: [],
  });
}

// ---------------------------------------------------------------------------
// Reference dates  (today at 10:00 local, then +1d / +2d)
// ---------------------------------------------------------------------------

function makeDate(base: Date, offsetHours = 0): Date {
  return new Date(base.getTime() + offsetHours * 60 * 60 * 1000);
}

const today = new Date();
today.setHours(10, 0, 0, 0);

const tomorrow = makeDate(today, 24);
const dayAfter = makeDate(today, 48);

// ---------------------------------------------------------------------------
// Flights to seed
// ---------------------------------------------------------------------------

const flightsToSeed: Array<FlightInventory> = [
  // ── CDG → LHR ──────────────────────────────────────────────────────────
  createFlight({
    flightId: "CDG-LHR-001",
    flightNumber: "AF123",
    origin: "CDG",
    destination: "LHR",
    departureTime: today,
    durationMinutes: 80,
    economyPrice: 120,
    businessPrice: 350,
    firstPrice: 800,
  }),
  createFlight({
    flightId: "CDG-LHR-001b",
    flightNumber: "AF123b",
    origin: "CDG",
    destination: "LHR",
    departureTime: makeDate(today, 2),
    durationMinutes: 80,
    economyPrice: 145,
    businessPrice: 410,
    firstPrice: 900,
  }),
  createFlight({
    flightId: "CDG-LHR-001c",
    flightNumber: "AF123c",
    origin: "CDG",
    destination: "LHR",
    departureTime: makeDate(today, 5),
    durationMinutes: 80,
    economyPrice: 95,
    businessPrice: 300,
    firstPrice: 700,
  }),
  createFlight({
    flightId: "CDG-LHR-002",
    flightNumber: "AF124",
    origin: "CDG",
    destination: "LHR",
    departureTime: tomorrow,
    durationMinutes: 80,
    economyPrice: 110,
    businessPrice: 320,
    firstPrice: 750,
  }),
  createFlight({
    flightId: "CDG-LHR-003",
    flightNumber: "AF125",
    origin: "CDG",
    destination: "LHR",
    departureTime: dayAfter,
    durationMinutes: 80,
    economyPrice: 130,
    businessPrice: 380,
    firstPrice: 850,
  }),

  // ── LHR → CDG ──────────────────────────────────────────────────────────
  createFlight({
    flightId: "LHR-CDG-001",
    flightNumber: "AF126",
    origin: "LHR",
    destination: "CDG",
    departureTime: today,
    durationMinutes: 80,
    economyPrice: 125,
    businessPrice: 360,
    firstPrice: 820,
  }),
  createFlight({
    flightId: "LHR-CDG-001b",
    flightNumber: "AF126b",
    origin: "LHR",
    destination: "CDG",
    departureTime: makeDate(today, 3),
    durationMinutes: 80,
    economyPrice: 155,
    businessPrice: 420,
    firstPrice: 950,
  }),
  createFlight({
    flightId: "LHR-CDG-002",
    flightNumber: "AF127",
    origin: "LHR",
    destination: "CDG",
    departureTime: tomorrow,
    durationMinutes: 80,
    economyPrice: 115,
    businessPrice: 330,
    firstPrice: 780,
  }),

  // ── CDG → JFK ──────────────────────────────────────────────────────────
  createFlight({
    flightId: "CDG-JFK-001",
    flightNumber: "AF006",
    origin: "CDG",
    destination: "JFK",
    departureTime: makeDate(today, 4),
    durationMinutes: 480, // ~8 h transatlantic
    stops: 0,
    economyPrice: 450,
    businessPrice: 1800,
    firstPrice: 4500,
    economyTotal: 250,
    businessTotal: 48,
    firstTotal: 12,
  }),
];

// ---------------------------------------------------------------------------
// Seed effect
// ---------------------------------------------------------------------------

const seed = Effect.gen(function* () {
  const repo = yield* InventoryRepository;
  const sql = yield* SqlClient.SqlClient;

  yield* Effect.logInfo("🗑️  Truncating tables…");
  yield* sql`TRUNCATE TABLE flight_inventory, event_outbox RESTART IDENTITY CASCADE`;

  yield* Effect.logInfo(`✈️  Seeding ${flightsToSeed.length} flights…`);

  yield* Effect.forEach(
    flightsToSeed,
    (flight) =>
      Effect.gen(function* () {
        yield* repo.save(flight);
        yield* Effect.logInfo(`   ✅ ${flight.flightId} saved`);
      }),
    { concurrency: 1 }, // sequential — preserves log order and avoids pool contention
  );

  yield* Effect.logInfo("🎉 Seeding completed successfully!");
});

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

Effect.runPromise(seed.pipe(Effect.provide(MainLayer))).catch((err) => {
  // biome-ignore lint/suspicious/noConsole: CLI entry point
  console.error("❌  Seeding failed:", err);
  process.exit(1);
});
