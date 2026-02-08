/**
 * @file inventory-queries.property.test.ts
 * @module @workspace/infrastructure/queries
 * @description Property-based tests for InventoryQueries
 */

import { SqlClient } from "@effect/sql";
import { fc, test } from "@fast-check/vitest";
import { InventoryQueries } from "@workspace/application/inventory-queries";
import { type CabinClass, type FlightId } from "@workspace/domain/kernel";
import { Effect, Layer, ManagedRuntime } from "effect";
import { describe, expect } from "vitest";
import { ConnectionPoolLive } from "../../../db/connection.js";
import { InventoryQueriesLive } from "../../../queries/inventory-queries.js";

// ============================================================================
// Test Setup
// ============================================================================

const TestLayer = InventoryQueriesLive.pipe(
  Layer.provideMerge(ConnectionPoolLive),
);

// Create a persistent runtime for all tests in this file
const runtime = ManagedRuntime.make(TestLayer);

// ============================================================================
// Property Metadata
// ============================================================================
const PROPERTIES = {
  NO_DOMAIN_LOGIC_IN_QUERIES: {
    number: 7,
    statement: "Inventory queries don't trigger domain logic",
    validates:
      "WHEN an inventory query is executed, THE Query_Handler SHALL return availability data without triggering domain logic",
    feature: "infrastructure-layer",
  },
  QUERY_FAILURES_TYPED_ERRORS: {
    number: 8,
    statement: "Query failures return typed errors",
    validates:
      "WHEN query execution fails, THE System SHALL return a typed error with diagnostic information",
    feature: "infrastructure-layer",
    requirements: "3.4",
  },
  FILTERING_SUPPORT: {
    number: 9,
    statement: "findAvailableFlights respects cabin and minSeats filter",
    validates:
      "THE Query_Handler SHALL support filtering by cabin and minimum seats",
    feature: "infrastructure-layer",
    requirements: "3.5",
  },
} as const;

// ============================================================================
// Test Helpers
// ============================================================================

function getCabinAvailability(
  flight: {
    economyAvailable: number;
    businessAvailable: number;
    firstAvailable: number;
  },
  cabin: CabinClass,
): number {
  const cabinMap: Record<CabinClass, number> = {
    ECONOMY: flight.economyAvailable,
    BUSINESS: flight.businessAvailable,
    FIRST: flight.firstAvailable,
  } as const;

  return cabinMap[cabin];
}

function hasLowInventoryInAnyCabin(
  flight: {
    economyAvailable: number;
    businessAvailable: number;
    firstAvailable: number;
  },
  threshold: number,
): boolean {
  return (
    flight.economyAvailable < threshold ||
    flight.businessAvailable < threshold ||
    flight.firstAvailable < threshold
  );
}

// ============================================================================
// Property Tests
// ============================================================================

describe("InventoryQueries Property Tests", () => {
  test.prop([fc.string({ minLength: 5, maxLength: 20 })], {
    numRuns: 10,
    timeout: 30000,
  })(
    `Property ${PROPERTIES.NO_DOMAIN_LOGIC_IN_QUERIES.number}: ${PROPERTIES.NO_DOMAIN_LOGIC_IN_QUERIES.statement}`,
    async (flightId) => {
      const program = Effect.gen(function* () {
        const queries = yield* InventoryQueries;
        const sql = yield* SqlClient.SqlClient;

        // Count events before query
        const beforeRows = yield* sql<{ count: number }>`
          SELECT COUNT(*)::int as count FROM event_outbox WHERE published_at IS NULL
        `;
        const eventsBefore = beforeRows[0]?.count ?? 0;

        // Execute query - it may fail if flight doesn't exist
        yield* queries
          .getFlightAvailability(flightId as FlightId)
          .pipe(Effect.either);

        // Count events after query
        const afterRows = yield* sql<{ count: number }>`
          SELECT COUNT(*)::int as count FROM event_outbox WHERE published_at IS NULL
        `;
        const eventsAfter = afterRows[0]?.count ?? 0;

        // No new events should be generated
        expect(eventsAfter).toBe(eventsBefore);

        return true;
      });

      const result = await runtime.runPromise(program);
      expect(result).toBe(true);
    },
  );

  test.prop([fc.string({ minLength: 5, maxLength: 20 })], {
    numRuns: 10,
    timeout: 30000,
  })(
    `Property ${PROPERTIES.QUERY_FAILURES_TYPED_ERRORS.number}: ${PROPERTIES.QUERY_FAILURES_TYPED_ERRORS.statement}`,
    async (invalidFlightId) => {
      const program = Effect.gen(function* () {
        const queries = yield* InventoryQueries;

        // Query for non-existent flight
        const result = yield* queries
          .getFlightAvailability(invalidFlightId as FlightId)
          .pipe(Effect.either);

        // Should fail with a typed error
        expect(result._tag).toBe("Left");
        if (result._tag === "Left") {
          const error = result.left;
          // Error should be either FlightNotFoundError or PersistenceError
          expect(["FlightNotFoundError", "PersistenceError"]).toContain(
            error._tag,
          );
        }

        return true;
      });

      const result = await runtime.runPromise(program);
      expect(result).toBe(true);
    },
  );

  test.prop(
    [
      fc.constantFrom<CabinClass>("ECONOMY", "BUSINESS", "FIRST"),
      fc.integer({ min: 1, max: 100 }), // minSeats
    ],
    { numRuns: 10, timeout: 30000 },
  )(
    `Property ${PROPERTIES.FILTERING_SUPPORT.number}: ${PROPERTIES.FILTERING_SUPPORT.statement}`,
    async (cabin, minSeats) => {
      const program = Effect.gen(function* () {
        const queries = yield* InventoryQueries;

        const result = yield* queries.findAvailableFlights({
          cabin,
          minSeats,
        });

        // Result should be an array
        expect(Array.isArray(result)).toBe(true);

        // All flights should have at least minSeats available in the specified cabin
        for (const flight of result) {
          const available = getCabinAvailability(flight, cabin);
          expect(available).toBeGreaterThanOrEqual(minSeats);
        }

        return true;
      });

      const result = await runtime.runPromise(program);
      expect(result).toBe(true);
    },
  );

  /**
   * Additional test: Verify inventory stats return valid data
   */
  test("Inventory stats return valid non-negative values", async () => {
    const program = Effect.gen(function* () {
      const queries = yield* InventoryQueries;

      const stats = yield* queries.getInventoryStats();

      // All stats should be non-negative
      expect(stats.totalFlights).toBeGreaterThanOrEqual(0);
      expect(stats.totalSeatsAvailable).toBeGreaterThanOrEqual(0);
      expect(stats.averageUtilization).toBeGreaterThanOrEqual(0);
      expect(stats.averageUtilization).toBeLessThanOrEqual(100);
      expect(stats.fullFlights).toBeGreaterThanOrEqual(0);
      expect(stats.fullFlights).toBeLessThanOrEqual(stats.totalFlights);

      return true;
    });

    const result = await runtime.runPromise(program);
    expect(result).toBe(true);
  });

  /**
   * Additional test: Low inventory alerts respect threshold
   */
  test.prop([fc.integer({ min: 0, max: 50 })], {
    numRuns: 10,
    timeout: 30000,
  })("Low inventory alerts respect threshold", async (threshold) => {
    const program = Effect.gen(function* () {
      const queries = yield* InventoryQueries;

      const alerts = yield* queries.getLowInventoryAlerts(threshold);

      // All flights in alerts should have at least one cabin below threshold
      for (const flight of alerts) {
        const hasLowInventory = hasLowInventoryInAnyCabin(flight, threshold);
        expect(hasLowInventory).toBe(true);
      }

      return true;
    });

    const result = await runtime.runPromise(program);
    expect(result).toBe(true);
  });
});
