import {
  type FlightFullError,
  type FlightNotFoundError,
  type InvalidAmountError,
  type InventoryOvercapacityError,
  type InventoryPersistenceError,
  type OptimisticLockingError,
} from "@workspace/domain/errors";
import { FlightInventory, SeatBucket } from "@workspace/domain/inventory";
import {
  type CabinClass,
  type FlightId,
  Money,
} from "@workspace/domain/kernel";
import { Context, Duration, Effect, Layer, Schedule } from "effect";
import { HoldSeatsResult, ReleaseSeatsResult } from "../models/results.js";
import { InventoryRepository } from "../repositories/inventory.repository.js";

export type HoldSeatsInput = {
  flightId: FlightId;
  cabin: CabinClass;
  numberOfSeats: number;
};

export interface InventoryServiceSignature {
  holdSeats: (
    params: HoldSeatsInput,
  ) => Effect.Effect<
    HoldSeatsResult,
    | FlightFullError
    | FlightNotFoundError
    | OptimisticLockingError
    | InvalidAmountError
    | InventoryPersistenceError
  >;
  releaseSeats: (
    params: HoldSeatsInput,
  ) => Effect.Effect<
    ReleaseSeatsResult,
    | FlightNotFoundError
    | OptimisticLockingError
    | InvalidAmountError
    | InventoryOvercapacityError
    | InventoryPersistenceError
  >;
  getAvailability: (
    flightId: FlightId,
  ) => Effect.Effect<
    FlightInventory,
    FlightNotFoundError | InventoryPersistenceError
  >;
}

export class InventoryService extends Context.Tag("InventoryService")<
  InventoryService,
  InventoryServiceSignature
>() {
  /**
   * Live Layer — Production implementation.
   * Requires InventoryRepository in context.
   */
  static readonly Live = Layer.effect(
    InventoryService,
    Effect.gen(function* () {
      // Resolve dependencies from context
      const repo = yield* InventoryRepository;

      // Retry policy for optimistic locking: exponential backoff, max 3 attempts
      const retryPolicy = Schedule.exponential(Duration.millis(100)).pipe(
        Schedule.compose(Schedule.recurs(3)),
      );

      return {
        holdSeats: ({ flightId, cabin, numberOfSeats }: HoldSeatsInput) =>
          Effect.gen(function* () {
            const inventory = yield* repo.getByFlightId(flightId);

            // Domain Logic moved to Entity (Rich Model)
            const [nextInventory, unitPrice] = yield* inventory.holdSeats(
              cabin,
              numberOfSeats,
            );

            // Save with optimistic locking - returns updated entity
            const savedInventory = yield* repo.save(nextInventory);
            const totalPrice = unitPrice.multiply(numberOfSeats);

            return new HoldSeatsResult({
              inventory: savedInventory,
              totalPrice,
              unitPrice,
              seatsHeld: numberOfSeats,
              holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
            });
          }).pipe(
            Effect.retry({
              times: 3,
              schedule: retryPolicy,
              while: (error) => error._tag === "OptimisticLockingError",
            }),
          ),

        releaseSeats: ({ flightId, cabin, numberOfSeats }: HoldSeatsInput) =>
          Effect.gen(function* () {
            const inventory = yield* repo.getByFlightId(flightId);

            // Domain Logic moved to Entity (Rich Model)
            const nextInventory = yield* inventory.releaseSeats(
              cabin,
              numberOfSeats,
            );

            // Save with optimistic locking - returns updated entity
            const savedInventory = yield* repo.save(nextInventory);

            return new ReleaseSeatsResult({
              inventory: savedInventory,
              seatsReleased: numberOfSeats,
            });
          }).pipe(
            Effect.retry({
              times: 3,
              schedule: retryPolicy,
              while: (error) => error._tag === "OptimisticLockingError",
            }),
          ),

        getAvailability: (flightId: FlightId) => repo.getByFlightId(flightId),
      };
    }),
  );

  /**
   * Helper to create mock inventory for tests.
   * Reduces duplication in test layer defaults.
   */
  private static makeMockInventory = (
    flightId: FlightId,
    economySeats = 10,
  ): FlightInventory =>
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
   * Test Layer — Factory that returns a complete Layer for tests.
   *
   * Default behaviors (without override):
   *   - holdSeats: Success with 10 economy seats available
   *   - getAvailability: Success with mock inventory
   *   - releaseSeats: Success with seats released
   *
   * Usage in a test:
   *   const layer = InventoryService.Test({ holdSeats: ... });
   *   program.pipe(Effect.provide(layer))
   */
  static readonly Test = (overrides: Partial<InventoryServiceSignature> = {}) =>
    Layer.succeed(
      InventoryService,
      InventoryService.of({
        // Default: Use real domain logic with mock inventory
        holdSeats: ({ flightId, cabin, numberOfSeats }) =>
          Effect.gen(function* () {
            const inventory = InventoryService.makeMockInventory(flightId);
            const [nextInventory, unitPrice] = yield* inventory.holdSeats(
              cabin,
              numberOfSeats,
            );
            return new HoldSeatsResult({
              inventory: nextInventory,
              totalPrice: unitPrice.multiply(numberOfSeats),
              unitPrice,
              seatsHeld: numberOfSeats,
              holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
            });
          }),
        getAvailability: (flightId) =>
          Effect.succeed(InventoryService.makeMockInventory(flightId)),
        releaseSeats: ({ flightId, cabin, numberOfSeats }) =>
          Effect.gen(function* () {
            const inventory = InventoryService.makeMockInventory(flightId);
            const nextInventory = yield* inventory.releaseSeats(
              cabin,
              numberOfSeats,
            );
            return new ReleaseSeatsResult({
              inventory: nextInventory,
              seatsReleased: numberOfSeats,
            });
          }),
        ...overrides,
      }),
    );
}
