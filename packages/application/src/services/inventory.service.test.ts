import { faker } from "@faker-js/faker";
import { FlightNotFoundError } from "@workspace/domain/errors";
import { FlightInventory, SeatBucket } from "@workspace/domain/inventory";
import { Money, makeFlightId } from "@workspace/domain/kernel";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
  InventoryRepository,
  type InventoryRepositoryPort,
} from "../repositories/inventory.repository.js";
import { InventoryService } from "./inventory.service.js";

describe("InventoryService", () => {
  const flightId = makeFlightId(faker.string.alphanumeric(6));

  const createMockInventory = (economySeats = 10): FlightInventory =>
    new FlightInventory({
      flightId,
      availability: {
        economy: new SeatBucket({
          available: economySeats,
          capacity: 100,
          price: Money.of(500, "EUR"),
        }),
        business: new SeatBucket({
          available: 5,
          capacity: 50,
          price: Money.of(1000, "USD"),
        }),
        first: new SeatBucket({
          available: 2,
          capacity: 20,
          price: Money.of(2000, "USD"),
        }),
      },
      version: 1,
      domainEvents: [],
    });

  /**
   * Helper to create a test layer with repository overrides.
   * Provides sensible defaults to reduce boilerplate.
   */
  const makeTestLayer = (overrides: Partial<InventoryRepositoryPort> = {}) =>
    InventoryService.Live.pipe(
      Layer.provide(
        Layer.succeed(
          InventoryRepository,
          InventoryRepository.of({
            getByFlightId: () => Effect.die("getByFlightId not implemented"),
            save: () => Effect.die("save not implemented"),
            findAvailableFlights: () => Effect.succeed([]),
            ...overrides,
          }),
        ),
      ),
    );

  describe("holdSeats", () => {
    it("should successfully hold seats and return correct result", async () => {
      const mockInventory = createMockInventory(10);
      let savedInventory: FlightInventory | null = null;

      const TestLayer = makeTestLayer({
        getByFlightId: () => Effect.succeed(mockInventory),
        save: (inventory) => {
          savedInventory = inventory;
          return Effect.succeed(inventory);
        },
      });

      const program = Effect.gen(function* () {
        const service = yield* InventoryService;
        return yield* service.holdSeats({
          flightId,
          cabin: "ECONOMY",
          numberOfSeats: 3,
        });
      }).pipe(Effect.provide(TestLayer));

      const result = await Effect.runPromise(program);

      // Verify result structure
      expect(result.seatsHeld).toBe(3);
      expect(result.unitPrice.amount).toBe(500);
      expect(result.totalPrice.amount).toBe(1500); // 500 * 3
      expect(
        (result.inventory as FlightInventory).availability.economy.available,
      ).toBe(7); // 10 - 3

      // Verify hold expiration is ~30 minutes
      const now = Date.now();
      const expiresAt = result.holdExpiresAt.getTime();
      const diffMinutes = (expiresAt - now) / (1000 * 60);
      expect(diffMinutes).toBeGreaterThan(29);
      expect(diffMinutes).toBeLessThan(31);

      // Verify inventory was saved
      expect(savedInventory).not.toBeNull();
      if (savedInventory) {
        expect(
          (savedInventory as FlightInventory).availability.economy.available,
        ).toBe(7);
      }
    });

    it("should fail when flight is not found", async () => {
      const TestLayer = makeTestLayer({
        getByFlightId: () =>
          Effect.fail(
            new FlightNotFoundError({ flightId: flightId.toString() }),
          ),
      });

      const program = Effect.gen(function* () {
        const service = yield* InventoryService;
        return yield* service.holdSeats({
          flightId,
          cabin: "ECONOMY",
          numberOfSeats: 1,
        });
      }).pipe(Effect.provide(TestLayer));

      const result = await Effect.runPromiseExit(program);

      expect(result._tag).toBe("Failure");
    });

    it("should fail when requesting more seats than available", async () => {
      const mockInventory = createMockInventory(5); // Only 5 seats available

      const TestLayer = makeTestLayer({
        getByFlightId: () => Effect.succeed(mockInventory),
      });

      const program = Effect.gen(function* () {
        const service = yield* InventoryService;
        return yield* service.holdSeats({
          flightId,
          cabin: "ECONOMY",
          numberOfSeats: 10, // Requesting more than available
        });
      }).pipe(Effect.provide(TestLayer));

      const result = await Effect.runPromiseExit(program);

      expect(result._tag).toBe("Failure");
    });

    it("should calculate total price correctly for multiple seats", async () => {
      const mockInventory = createMockInventory(20);

      const TestLayer = makeTestLayer({
        getByFlightId: () => Effect.succeed(mockInventory),
        save: (inventory) => Effect.succeed(inventory),
      });

      const program = Effect.gen(function* () {
        const service = yield* InventoryService;
        return yield* service.holdSeats({
          flightId,
          cabin: "ECONOMY",
          numberOfSeats: 7,
        });
      }).pipe(Effect.provide(TestLayer));

      const result = await Effect.runPromise(program);

      expect(result.unitPrice.amount).toBe(500);
      expect(result.totalPrice.amount).toBe(3500); // 500 * 7
      expect(result.seatsHeld).toBe(7);
    });
  });

  describe("releaseSeats", () => {
    it("should successfully release seats", async () => {
      const mockInventory = createMockInventory(5); // 5 seats available
      let savedInventory: FlightInventory | null = null;

      const TestLayer = makeTestLayer({
        getByFlightId: () => Effect.succeed(mockInventory),
        save: (inventory) => {
          savedInventory = inventory;
          return Effect.succeed(inventory);
        },
      });

      const program = Effect.gen(function* () {
        const service = yield* InventoryService;
        return yield* service.releaseSeats({
          flightId,
          cabin: "ECONOMY",
          numberOfSeats: 3,
        });
      }).pipe(Effect.provide(TestLayer));

      const result = await Effect.runPromise(program);

      expect(result.seatsReleased).toBe(3);
      expect(
        (result.inventory as FlightInventory).availability.economy.available,
      ).toBe(8); // 5 + 3

      // Verify inventory was saved
      expect(savedInventory).not.toBeNull();
      if (savedInventory) {
        expect(
          (savedInventory as FlightInventory).availability.economy.available,
        ).toBe(8);
      }
    });

    it("should fail when flight is not found", async () => {
      const TestLayer = makeTestLayer({
        getByFlightId: () =>
          Effect.fail(
            new FlightNotFoundError({ flightId: flightId.toString() }),
          ),
      });

      const program = Effect.gen(function* () {
        const service = yield* InventoryService;
        return yield* service.releaseSeats({
          flightId,
          cabin: "ECONOMY",
          numberOfSeats: 1,
        });
      }).pipe(Effect.provide(TestLayer));

      const result = await Effect.runPromiseExit(program);

      expect(result._tag).toBe("Failure");
    });
  });

  describe("getAvailability", () => {
    it("should return flight inventory", async () => {
      const mockInventory = createMockInventory(15);

      const TestLayer = makeTestLayer({
        getByFlightId: () => Effect.succeed(mockInventory),
      });

      const program = Effect.gen(function* () {
        const service = yield* InventoryService;
        return yield* service.getAvailability(flightId);
      }).pipe(Effect.provide(TestLayer));

      const result = await Effect.runPromise(program);

      expect(result.flightId).toBe(flightId);
      expect(result.availability.economy.available).toBe(15);
      expect(result.availability.business.available).toBe(5);
      expect(result.availability.first.available).toBe(2);
    });

    it("should fail when flight is not found", async () => {
      const TestLayer = makeTestLayer({
        getByFlightId: () =>
          Effect.fail(
            new FlightNotFoundError({ flightId: flightId.toString() }),
          ),
      });

      const program = Effect.gen(function* () {
        const service = yield* InventoryService;
        return yield* service.getAvailability(flightId);
      }).pipe(Effect.provide(TestLayer));

      const result = await Effect.runPromiseExit(program);

      expect(result._tag).toBe("Failure");
    });
  });
});
