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

const createFlight = (params: FlightParams): FlightInventory => {
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
};

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const makeDate = (base: Date, offsetHours = 0): Date =>
  new Date(base.getTime() + offsetHours * 60 * 60 * 1000);

const addDays = (base: Date, days: number): Date => makeDate(base, days * 24);

const today = new Date();
today.setHours(10, 0, 0, 0);

// ---------------------------------------------------------------------------
// Route definitions — each route gets flights across multiple days & times
// ---------------------------------------------------------------------------

interface RouteConfig {
  origin: string;
  destination: string;
  prefix: string; // flight number prefix e.g. "AF"
  baseNumber: number; // starting flight number
  durationMinutes: number;
  stops: number;
  /** Base prices [economy, business, first] — varied per departure */
  basePrices: [number, number, number];
  /** Seat capacities [economy, business, first] */
  capacities: [number, number, number];
  /** Departure hour offsets from 06:00 for each daily slot */
  dailySlots: Array<number>;
  /** Number of days to generate (starting from today) */
  days: number;
}

const routes: Array<RouteConfig> = [
  // ── Short-haul Europe ───────────────────────────────────────────────────
  {
    origin: "CDG",
    destination: "LHR",
    prefix: "AF",
    baseNumber: 100,
    durationMinutes: 80,
    stops: 0,
    basePrices: [120, 350, 800],
    capacities: [150, 30, 12],
    dailySlots: [0, 5, 14],
    days: 180,
  },
  {
    origin: "LHR",
    destination: "CDG",
    prefix: "AF",
    baseNumber: 200,
    durationMinutes: 80,
    stops: 0,
    basePrices: [125, 360, 820],
    capacities: [150, 30, 12],
    dailySlots: [1, 7, 13],
    days: 180,
  },
  {
    origin: "CDG",
    destination: "FRA",
    prefix: "AF",
    baseNumber: 300,
    durationMinutes: 95,
    stops: 0,
    basePrices: [110, 320, 750],
    capacities: [140, 28, 10],
    dailySlots: [0, 6, 14],
    days: 180,
  },
  {
    origin: "FRA",
    destination: "CDG",
    prefix: "AF",
    baseNumber: 400,
    durationMinutes: 95,
    stops: 0,
    basePrices: [115, 330, 770],
    capacities: [140, 28, 10],
    dailySlots: [1, 8, 12],
    days: 180,
  },
  {
    origin: "CDG",
    destination: "BCN",
    prefix: "AF",
    baseNumber: 500,
    durationMinutes: 115,
    stops: 0,
    basePrices: [95, 280, 650],
    capacities: [160, 32, 8],
    dailySlots: [0, 9],
    days: 180,
  },
  {
    origin: "BCN",
    destination: "CDG",
    prefix: "AF",
    baseNumber: 600,
    durationMinutes: 115,
    stops: 0,
    basePrices: [100, 290, 670],
    capacities: [160, 32, 8],
    dailySlots: [2, 10],
    days: 180,
  },

  // ── Transatlantic ───────────────────────────────────────────────────────
  {
    origin: "CDG",
    destination: "JFK",
    prefix: "AF",
    baseNumber: 1100,
    durationMinutes: 480,
    stops: 0,
    basePrices: [450, 1800, 4500],
    capacities: [250, 48, 12],
    dailySlots: [0, 10],
    days: 180,
  },
  {
    origin: "JFK",
    destination: "CDG",
    prefix: "AF",
    baseNumber: 1200,
    durationMinutes: 440,
    stops: 0,
    basePrices: [470, 1850, 4600],
    capacities: [250, 48, 12],
    dailySlots: [2, 14],
    days: 180,
  },

  // ── Africa (New Routes) ─────────────────────────────────────────────────
  {
    origin: "CDG",
    destination: "CMN", // Casablanca, Maroc
    prefix: "AT", // Royal Air Maroc / Air France codeshare
    baseNumber: 3100,
    durationMinutes: 190,
    stops: 0,
    basePrices: [180, 500, 1200],
    capacities: [180, 30, 0], // Focus is largely economy & business
    dailySlots: [2, 8],
    days: 180,
  },
  {
    origin: "CMN",
    destination: "CDG",
    prefix: "AT",
    baseNumber: 3200,
    durationMinutes: 190,
    stops: 0,
    basePrices: [190, 520, 1250],
    capacities: [180, 30, 0],
    dailySlots: [4, 11],
    days: 180,
  },
  {
    origin: "CDG",
    destination: "DSS", // Dakar, Senegal
    prefix: "AF",
    baseNumber: 3300,
    durationMinutes: 350,
    stops: 0,
    basePrices: [380, 1400, 3200],
    capacities: [260, 36, 8], // Boeing 777-esque
    dailySlots: [4], // Once a day
    days: 180,
  },
  {
    origin: "DSS",
    destination: "CDG",
    prefix: "AF",
    baseNumber: 3400,
    durationMinutes: 340,
    stops: 0,
    basePrices: [390, 1450, 3300],
    capacities: [260, 36, 8],
    dailySlots: [16], // Late evening departure from DSS
    days: 180,
  },
  {
    origin: "CDG",
    destination: "ABJ", // Abidjan, Cote d'Ivoire
    prefix: "AF",
    baseNumber: 3500,
    durationMinutes: 390,
    stops: 0,
    basePrices: [420, 1600, 3800],
    capacities: [280, 42, 10], // High capacity Widebody
    dailySlots: [8],
    days: 180,
  },
  {
    origin: "ABJ",
    destination: "CDG",
    prefix: "AF",
    baseNumber: 3600,
    durationMinutes: 380,
    stops: 0,
    basePrices: [440, 1650, 3900],
    capacities: [280, 42, 10],
    dailySlots: [17], // Overnight flight
    days: 180,
  },
];

// ---------------------------------------------------------------------------
// Price variation — simulates demand-based pricing across days & slots
// ---------------------------------------------------------------------------

/** Deterministic price jitter based on day + slot index */
const varyPrice = (base: number, dayIdx: number, slotIdx: number): number => {
  // Weekend surcharge (Fri=5, Sat=6, Sun=0)
  const dayOfWeek = addDays(today, dayIdx).getDay();
  const weekendMultiplier =
    dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6 ? 1.15 : 1.0;

  // Time-of-day factor: early morning & late evening cheaper, midday peak
  const timeFactor = 1 + 0.08 * Math.sin((slotIdx / 5) * Math.PI);

  // Advance purchase: flights further out are slightly cheaper
  const advanceFactor = 1 - dayIdx * 0.005;

  return Math.round(base * weekendMultiplier * timeFactor * advanceFactor);
};

// ---------------------------------------------------------------------------
// Generate all flights from route configs
// ---------------------------------------------------------------------------

const flightsToSeed: Array<FlightInventory> = [];

for (const route of routes) {
  let flightCounter = 0;

  for (let day = 0; day < route.days; day++) {
    const baseDay = addDays(today, day);
    // Set base to 06:00 on that day
    baseDay.setHours(6, 0, 0, 0);

    for (let slotIdx = 0; slotIdx < route.dailySlots.length; slotIdx++) {
      const hourOffset = route.dailySlots[slotIdx] ?? 0;
      const departure = makeDate(baseDay, hourOffset);
      const num = route.baseNumber + flightCounter;
      const padded = String(num).padStart(4, "0");

      flightsToSeed.push(
        createFlight({
          flightId: `${route.origin}-${route.destination}-d${day}s${slotIdx}`,
          flightNumber: `${route.prefix}${padded}`,
          origin: route.origin,
          destination: route.destination,
          departureTime: departure,
          durationMinutes: route.durationMinutes,
          stops: route.stops,
          economyPrice: varyPrice(route.basePrices[0], day, slotIdx),
          businessPrice: varyPrice(route.basePrices[1], day, slotIdx),
          firstPrice: varyPrice(route.basePrices[2], day, slotIdx),
          economyTotal: route.capacities[0],
          businessTotal: route.capacities[1],
          firstTotal: route.capacities[2],
        }),
      );

      flightCounter++;
    }
  }
}

// ---------------------------------------------------------------------------
// Seed effect
// ---------------------------------------------------------------------------

const seed = Effect.gen(function* () {
  const repo = yield* InventoryRepository;
  const sql = yield* SqlClient.SqlClient;

  yield* Effect.logInfo("🗑️  Truncating tables…");
  yield* sql`TRUNCATE TABLE flight_inventory, event_outbox RESTART IDENTITY CASCADE`;

  yield* Effect.logInfo(
    `✈️  Seeding ${flightsToSeed.length} flights across ${routes.length} routes…`,
  );

  // Batch in groups of 20 for faster inserts while keeping logs readable
  const batchSize = 20;
  for (let i = 0; i < flightsToSeed.length; i += batchSize) {
    const batch = flightsToSeed.slice(i, i + batchSize);
    yield* Effect.forEach(batch, (flight) => repo.save(flight), {
      concurrency: 5,
    });
    yield* Effect.logInfo(
      `   ✅ ${Math.min(i + batchSize, flightsToSeed.length)}/${flightsToSeed.length} flights saved`,
    );
  }

  // Summary by route
  const routeSummary = routes
    .map(
      (r) =>
        `${r.origin}→${r.destination}: ${r.dailySlots.length * r.days} flights`,
    )
    .join(", ");
  yield* Effect.logInfo(`📊 ${routeSummary}`);
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
