#!/usr/bin/env tsx
import path from "node:path";
import { fileURLToPath } from "node:url";
import { InventoryRepository } from "@workspace/application/inventory.repository";
import { FlightInventory, SeatBucket } from "@workspace/domain/inventory";
import { FlightId, Money } from "@workspace/domain/kernel";
import * as dotenv from "dotenv";
import { Effect, Layer, Schema } from "effect";
import { ConnectionPoolLive } from "../src/db/connection.js";
import { PostgresInventoryRepositoryLive } from "../src/repositories/postgres-inventory.repository.js";

// Load .env.test specifically
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env.test") });

const MainLayer = PostgresInventoryRepositoryLive.pipe(
  Layer.provide(ConnectionPoolLive),
);

const createFlight = (
  flightId: string,
  economy: { price: number; total: number },
  business: { price: number; total: number },
  first: { price: number; total: number },
) =>
  new FlightInventory({
    flightId: Schema.decodeSync(FlightId)(flightId),
    availability: {
      economy: new SeatBucket({
        capacity: economy.total,
        available: economy.total,
        price: Money.of(economy.price, "EUR"),
      }),
      business: new SeatBucket({
        capacity: business.total,
        available: business.total,
        price: Money.of(business.price, "EUR"),
      }),
      first: new SeatBucket({
        capacity: first.total,
        available: first.total,
        price: Money.of(first.price, "EUR"),
      }),
    },
    version: 0,
    domainEvents: [],
  });

const seed = Effect.gen(function* () {
  const repo = yield* InventoryRepository;

  yield* Effect.logInfo("Seeding flights...");

  const flights = [
    createFlight(
      "AF123",
      { price: 120, total: 150 },
      { price: 450, total: 30 },
      { price: 950, total: 10 },
    ),
    createFlight(
      "BA456",
      { price: 90, total: 120 },
      { price: 350, total: 20 },
      { price: 800, total: 5 },
    ),
    createFlight(
      "LH789",
      { price: 600, total: 200 },
      { price: 1200, total: 40 },
      { price: 2500, total: 12 },
    ),
  ];

  for (const flight of flights) {
    yield* repo.save(flight);
    yield* Effect.logInfo(`Flight ${flight.flightId} seeded.`);
  }

  yield* Effect.logInfo("Database seeding completed successfully!");
});

Effect.runPromise(seed.pipe(Effect.provide(MainLayer))).catch((err) => {
  // biome-ignore lint/suspicious/noConsole: <>
  console.error("Seeding failed:", err);
  process.exit(1);
});
