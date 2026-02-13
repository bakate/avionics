/**
 * Property-Based Tests for FlightInventory
 * These tests verify universal properties that should hold for all valid inputs
 */

import { fc } from "@fast-check/vitest";
import { Effect } from "effect";
import { describe, expect, test } from "vitest";
import {
  FlightInventory,
  SeatBucket,
} from "../../../flight/flight-inventory.js";
import { type CurrencyCode, Money, makeFlightId } from "../../../kernel.js";

// Arbitraries (generators for random test data)
const arbMoney = fc
  .record({
    amount: fc.integer({ min: 100, max: 10000 }),
    currency: fc.constantFrom("EUR", "USD", "GBP", "CHF"),
  })
  .map(({ amount, currency }) => Money.of(amount, currency as CurrencyCode));

const arbSeatBucket = fc
  .record({
    available: fc.integer({ min: 0, max: 100 }),
    capacity: fc.integer({ min: 50, max: 200 }),
    price: arbMoney,
  })
  .chain((props) =>
    fc.record({
      available: fc.constant(Math.min(props.available, props.capacity)),
      capacity: fc.constant(props.capacity),
      price: fc.constant(props.price),
    }),
  )
  .map((props) => new SeatBucket(props));

const arbFlightInventory = fc
  .record({
    flightId: fc.string({ minLength: 5, maxLength: 10 }),
    economy: arbSeatBucket,
    business: arbSeatBucket,
    first: arbSeatBucket,
    version: fc.integer({ min: 0, max: 100 }),
  })
  .map(
    ({ flightId, economy, business, first, version }) =>
      new FlightInventory({
        flightId: makeFlightId(flightId),
        availability: { economy, business, first },
        version,
        domainEvents: [],
      }),
  );

describe("FlightInventory - Property-Based Tests", () => {
  test("Property 1: Hold then release restores availability", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbFlightInventory,
        fc.integer({ min: 1, max: 10 }),
        async (inventory, amount) => {
          const cabin = "ECONOMY";
          const bucket = inventory.availability.economy;

          // Skip if not enough seats
          if (bucket.available < amount) return;

          const program = Effect.gen(function* () {
            // Hold seats
            const [heldInventory] = yield* inventory.holdSeats(cabin, amount);

            // Release same amount
            const restoredInventory = yield* heldInventory.releaseSeats(
              cabin,
              amount,
            );

            // Availability should be restored
            return (
              restoredInventory.availability.economy.available ===
              inventory.availability.economy.available
            );
          });

          const result = await Effect.runPromise(program);
          expect(result).toBe(true);
        },
      ),
    );
  });

  test("Property 2: Holding seats decreases availability by exact amount", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbFlightInventory,
        fc.integer({ min: 1, max: 10 }),
        async (inventory, amount) => {
          const cabin = "ECONOMY";
          const bucket = inventory.availability.economy;

          // Skip if not enough seats
          if (bucket.available < amount) return;

          const program = Effect.gen(function* () {
            const [heldInventory] = yield* inventory.holdSeats(cabin, amount);

            return (
              heldInventory.availability.economy.available ===
              bucket.available - amount
            );
          });

          const result = await Effect.runPromise(program);
          expect(result).toBe(true);
        },
      ),
    );
  });

  test("Property 3: Version remains stable in domain (infrastructure handles increments)", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbFlightInventory,
        fc.integer({ min: 1, max: 10 }),
        async (inventory, amount) => {
          const cabin = "ECONOMY";
          const bucket = inventory.availability.economy;

          // Skip if not enough seats
          if (bucket.available < amount) return;

          const program = Effect.gen(function* () {
            const initialVersion = inventory.version;
            const [heldInventory] = yield* inventory.holdSeats(cabin, amount);

            return heldInventory.version === initialVersion;
          });

          const result = await Effect.runPromise(program);
          expect(result).toBe(true);
        },
      ),
    );
  });

  test("Property 4: Cannot hold more seats than available", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbFlightInventory,
        fc.integer({ min: 1, max: 5 }),
        async (inventory, extraSeats) => {
          const cabin = "ECONOMY";
          const bucket = inventory.availability.economy;
          const tooMany = bucket.available + extraSeats;

          const program = inventory.holdSeats(cabin, tooMany).pipe(
            Effect.map(() => false), // Should not succeed
            Effect.catchTag("FlightFullError", () => Effect.succeed(true)),
          );

          const result = await Effect.runPromise(program);
          expect(result).toBe(true);
        },
      ),
    );
  });

  test("Property 5: Domain events are emitted on state changes", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbFlightInventory,
        fc.integer({ min: 1, max: 10 }),
        async (inventory, amount) => {
          const cabin = "ECONOMY";
          const bucket = inventory.availability.economy;

          // Skip if not enough seats
          if (bucket.available < amount) return;

          const program = Effect.gen(function* () {
            const [heldInventory] = yield* inventory.holdSeats(cabin, amount);

            // Should have at least one event
            return heldInventory.domainEvents.length > 0;
          });

          const result = await Effect.runPromise(program);
          expect(result).toBe(true);
        },
      ),
    );
  });

  test("Property 6: Multiple holds are cumulative", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbFlightInventory,
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        async (inventory, amount1, amount2) => {
          const cabin = "ECONOMY";
          const bucket = inventory.availability.economy;
          const totalAmount = amount1 + amount2;

          // Skip if not enough seats
          if (bucket.available < totalAmount) return;

          const program = Effect.gen(function* () {
            // First hold
            const [inventory1] = yield* inventory.holdSeats(cabin, amount1);
            // Second hold
            const [inventory2] = yield* inventory1.holdSeats(cabin, amount2);

            return (
              inventory2.availability.economy.available ===
              bucket.available - totalAmount
            );
          });

          const result = await Effect.runPromise(program);
          expect(result).toBe(true);
        },
      ),
    );
  });
});
