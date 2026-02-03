import { InventoryRepository } from "@workspace/application/inventory.repository";
import {
  FlightNotFoundError,
  OptimisticLockingError,
} from "@workspace/domain/errors";
import { FlightId } from "@workspace/domain/kernel";
import { Effect, Layer, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConnectionPoolLive } from "../../db/connection.js";
import { PostgresInventoryRepositoryLive } from "../../repositories/postgres-inventory.repository.js";
import { createTestInventory } from "../factories/inventory-factory.js";
import { cleanDatabase } from "../helpers/db-test-helper.js";

const TestLayer = PostgresInventoryRepositoryLive.pipe(
  Layer.provide(ConnectionPoolLive),
);

const runTest = <A, E>(effect: Effect.Effect<A, E, InventoryRepository>) =>
  Effect.runPromise(Effect.provide(effect, TestLayer));

describe("InventoryRepository Integration Tests", () => {
  // Clean database before each test
  beforeEach(async () => {
    await Effect.runPromise(Effect.provide(cleanDatabase, ConnectionPoolLive));
  });

  // Clean database after each test to restore clean state
  afterEach(async () => {
    await Effect.runPromise(Effect.provide(cleanDatabase, ConnectionPoolLive));
  });

  describe("save", () => {
    it("should create a new flight inventory", async () => {
      const inventory = createTestInventory({
        flightId: "FL100",
        economyTotal: 150,
        economyAvailable: 150,
        businessTotal: 30,
        businessAvailable: 30,
        firstTotal: 12,
        firstAvailable: 12,
      });

      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* InventoryRepository;
          const saved = yield* repo.save(inventory);

          // Verify it was saved
          const found = yield* repo.getByFlightId(
            Schema.decodeSync(FlightId)("FL100"),
          );
          return { saved, found };
        }),
      );

      expect(result.saved).toBeDefined();
      expect(result.saved.version).toBe(1);
      expect(result.found.flightId.valueOf()).toBe("FL100");
      expect(result.found.availability.economy.available).toBe(150);
      expect(result.found.availability.business.available).toBe(30);
      expect(result.found.availability.first.available).toBe(12);
    });

    it("should update existing inventory and increment version", async () => {
      const inventory = createTestInventory({
        flightId: "FL101",
        economyAvailable: 100,
      });

      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* InventoryRepository;

          // Create
          yield* repo.save(inventory);

          // Update - hold 10 seats
          const found = yield* repo.getByFlightId(
            Schema.decodeSync(FlightId)("FL101"),
          );
          const [updated] = yield* found.holdSeats("ECONOMY", 10);
          const saved = yield* repo.save(updated);

          // Verify version incremented
          const final = yield* repo.getByFlightId(
            Schema.decodeSync(FlightId)("FL101"),
          );
          return { saved, final };
        }),
      );

      expect(result.saved.version).toBe(2);
      expect(result.final.version).toBe(2);
      expect(result.final.availability.economy.available).toBe(90);
    });

    it("should throw OptimisticLockingError on version mismatch", async () => {
      const inventory = createTestInventory({
        flightId: "FL102",
        economyAvailable: 100,
      });

      const error = await runTest(
        Effect.gen(function* () {
          const repo = yield* InventoryRepository;

          // Create
          yield* repo.save(inventory);

          // Simulate concurrent update by manually creating stale version
          const found = yield* repo.getByFlightId(
            Schema.decodeSync(FlightId)("FL102"),
          );

          // Update once (version becomes 2)
          const [updated1] = yield* found.holdSeats("ECONOMY", 10);
          yield* repo.save(updated1);

          // Try to save with stale version (still 1)
          const [stale] = yield* found.holdSeats("ECONOMY", 5);
          return yield* repo.save(stale);
        }),
      ).then(
        () => null,
        (e) => e,
      );

      expect(String(error)).toContain("OptimisticLockingError");
    });
  });

  describe("getByFlightId", () => {
    it("should throw FlightNotFoundError when flight does not exist", async () => {
      const error = await runTest(
        Effect.gen(function* () {
          const repo = yield* InventoryRepository;
          return yield* repo.getByFlightId(
            Schema.decodeSync(FlightId)("NOTFOUND"),
          );
        }),
      ).then(
        () => null,
        (e) => e,
      );
      expect(String(error)).toContain("FlightNotFoundError");
    });

    it("should load inventory with all seat buckets", async () => {
      const inventory = createTestInventory({
        flightId: "FL103",
        economyTotal: 200,
        economyAvailable: 180,
        businessTotal: 40,
        businessAvailable: 35,
        firstTotal: 16,
        firstAvailable: 14,
      });

      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* InventoryRepository;
          yield* repo.save(inventory);

          return yield* repo.getByFlightId(
            Schema.decodeSync(FlightId)("FL103"),
          );
        }),
      );

      expect(result.flightId.valueOf()).toBe("FL103");
      expect(result.availability.economy.capacity).toBe(200);
      expect(result.availability.economy.available).toBe(180);
      expect(result.availability.business.capacity).toBe(40);
      expect(result.availability.business.available).toBe(35);
      expect(result.availability.first.capacity).toBe(16);
      expect(result.availability.first.available).toBe(14);
    });
  });

  describe("seat operations", () => {
    it("should hold seats correctly", async () => {
      const inventory = createTestInventory({
        flightId: "FL104",
        economyAvailable: 100,
      });

      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* InventoryRepository;
          yield* repo.save(inventory);

          const found = yield* repo.getByFlightId(
            Schema.decodeSync(FlightId)("FL104"),
          );
          const [updated] = yield* found.holdSeats("ECONOMY", 25);
          yield* repo.save(updated);

          return yield* repo.getByFlightId(
            Schema.decodeSync(FlightId)("FL104"),
          );
        }),
      );

      expect(result.availability.economy.available).toBe(75);
    });

    it("should release seats correctly", async () => {
      const inventory = createTestInventory({
        flightId: "FL105",
        economyAvailable: 50,
      });

      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* InventoryRepository;
          yield* repo.save(inventory);

          const found = yield* repo.getByFlightId(
            Schema.decodeSync(FlightId)("FL105"),
          );
          const updated = yield* found.releaseSeats("ECONOMY", 10);
          yield* repo.save(updated);

          return yield* repo.getByFlightId(
            Schema.decodeSync(FlightId)("FL105"),
          );
        }),
      );

      expect(result.availability.economy.available).toBe(60);
    });
  });

  describe("findAvailableFlights", () => {
    it("should find flights with available economy seats", async () => {
      await runTest(
        Effect.gen(function* () {
          const repo = yield* InventoryRepository;

          // Create flights with different availability
          yield* repo.save(
            createTestInventory({
              flightId: "FL200",
              economyAvailable: 50,
            }),
          );
          yield* repo.save(
            createTestInventory({
              flightId: "FL201",
              economyAvailable: 10,
            }),
          );
          yield* repo.save(
            createTestInventory({
              flightId: "FL202",
              economyAvailable: 5,
            }),
          );
        }),
      );

      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* InventoryRepository;
          return yield* repo.findAvailableFlights("ECONOMY", 20);
        }),
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.flightId.valueOf()).toBe("FL200");
    });
  });
});
