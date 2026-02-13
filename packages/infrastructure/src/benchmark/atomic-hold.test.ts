import path from "node:path";
import { InventoryRepository } from "@workspace/application/inventory.repository";
import { InventoryService } from "@workspace/application/inventory.service";
import { FlightId } from "@workspace/domain/kernel";
import * as dotenv from "dotenv";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { ConnectionPoolLive } from "../db/connection.js";
import { PostgresInventoryRepositoryLive } from "../repositories/postgres-inventory.repository.js";
import { createTestInventory } from "../test/factories/inventory-factory.js";
import { cleanDatabase } from "../test/helpers/db-test-helper.js";

// Load env vars explicitly if not loaded by vitest (benchmark might need it)
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });

// Configuration
const CONCURRENT_USERS = 50;
const SEATS_PER_USER = 1;
const FLIGHT_ID = "BENCH-100";
const TOTAL_SEATS = 100;

// Setup Layer
const BenchmarkLayer = InventoryService.Live.pipe(
  Layer.provide(PostgresInventoryRepositoryLive),
  Layer.provide(ConnectionPoolLive),
);

// Helper runner
const runBenchmark = <A, E>(effect: Effect.Effect<A, E, InventoryService>) =>
  Effect.runPromise(Effect.provide(effect, BenchmarkLayer));

describe("Atomic Hold Benchmark (Optimistic Locking)", () => {
  it(`should handle ${CONCURRENT_USERS} concurrent hold requests without overbooking`, async () => {
    // 1. Setup: Clean DB and create flight
    // We need both SqlClient (for cleanDatabase) and InventoryRepository (for seeding)
    const repoLayer = PostgresInventoryRepositoryLive.pipe(
      Layer.provide(ConnectionPoolLive),
    );
    const setupLayer = Layer.merge(ConnectionPoolLive, repoLayer);

    await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          // Clean DB
          yield* cleanDatabase;

          const repo = yield* InventoryRepository;
          yield* repo.save(
            createTestInventory({
              flightId: FLIGHT_ID,
              economyTotal: TOTAL_SEATS,
              economyAvailable: TOTAL_SEATS,
            }),
          );
          yield* Effect.log(
            `[Setup] Created flight ${FLIGHT_ID} with ${TOTAL_SEATS} seats.`,
          );
        }),
        setupLayer,
      ),
    );

    // 2. Execution
    await Effect.runPromise(
      Effect.log(
        `[Benchmark] Starting ${CONCURRENT_USERS} concurrent requests...`,
      ),
    );
    const startTime = Date.now();

    const results = await runBenchmark(
      Effect.gen(function* () {
        const service = yield* InventoryService;

        // Create an array of effects
        const tasks = Array.from({ length: CONCURRENT_USERS }, (_, i) =>
          service
            .holdSeats({
              flightId: Schema.decodeSync(FlightId)(FLIGHT_ID),
              cabin: "ECONOMY",
              numberOfSeats: SEATS_PER_USER,
            })
            .pipe(
              Effect.map(() => ({ success: true, id: i })),
              Effect.catchAll((e) =>
                Effect.succeed({ success: false, id: i, error: e }),
              ),
            ),
        );

        // Run in parallel with unlimited concurrency
        return yield* Effect.all(tasks, { concurrency: "unbounded" });
      }),
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    // 3. Analysis
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);

    await Effect.runPromise(
      Effect.log(`[Results]
    - Total Requests: ${CONCURRENT_USERS}
    - Successful: ${successful}
    - Failed: ${failed.length}
    - Duration: ${duration}ms
    - RPS: ${(CONCURRENT_USERS / (duration / 1000)).toFixed(2)}
    `),
    );

    // 4. Verification
    const finalState = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const repo = yield* InventoryRepository;
          return yield* repo.getByFlightId(
            Schema.decodeSync(FlightId)(FLIGHT_ID),
          );
        }),
        setupLayer,
      ),
    );

    await Effect.runPromise(
      Effect.log(`[Verification]
    - Expected Available: ${TOTAL_SEATS - successful * SEATS_PER_USER}
    - Actual Available: ${finalState.availability.economy.available}
    - Version: ${finalState.version}
    `),
    );

    expect(finalState.availability.economy.available).toBe(
      TOTAL_SEATS - successful * SEATS_PER_USER,
    );
    expect(successful).toBe(CONCURRENT_USERS);
  });
});
