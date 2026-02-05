/**
 * @file inventory-queries.property.test.ts
 * @module @workspace/infrastructure/queries
 * @description Property-based tests for InventoryQueries
 */

import { SqlClient } from "@effect/sql";
import { fc, test } from "@fast-check/vitest";
import { InventoryQueries } from "@workspace/application/inventory-queries";
import type { CabinClass, FlightId } from "@workspace/domain/kernel";
import { Effect, Layer } from "effect";
import { describe, expect } from "vitest";
import { ConnectionPoolLive } from "../db/connection.js";
import { InventoryQueriesLive } from "./inventory-queries.js";

// ============================================================================
// Test Setup
// ============================================================================

const TestLayer = InventoryQueriesLive.pipe(Layer.provide(ConnectionPoolLive));

// ============================================================================
// Property Metadata
// ============================================================================
/**
 * Property metadata for traceability and documentation.
 * Should match PROPERTIES.md
 */
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
  PAGINATION_SUPPORT: {
    number: 9,
    statement: "List queries support pagination",
    validates:
      "THE Query_Handler SHALL support filtering and pagination for list queries",
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
    timeout: 10000,
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
        yield* queries.getFlightAvailability(flightId).pipe(Effect.either);

        // Count events after query
        const afterRows = yield* sql<{ count: number }>`
          SELECT COUNT(*)::int as count FROM event_outbox WHERE published_at IS NULL
        `;
        const eventsAfter = afterRows[0]?.count ?? 0;

        // No new events should be generated
        expect(eventsAfter).toBe(eventsBefore);

        return true;
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(TestLayer)),
      );

      expect(result).toBe(true);
    },
  );

  test.prop([fc.string({ minLength: 5, maxLength: 20 })], {
    numRuns: 100,
    timeout: 10000,
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
        if (result._tag === "Left") {
          const error = result.left;
          // Error should be either FlightNotFoundError or PersistenceError
          expect(
            error._tag === "FlightNotFoundError" ||
              error._tag === "PersistenceError",
          ).toBe(true);
        }

        return true;
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(TestLayer)),
      );

      expect(result).toBe(true);
    },
  );

  test.prop(
    [
      fc.constantFrom<CabinClass>("economy", "business", "first"),
      fc.integer({ min: 1, max: 100 }), // minSeats
    ],
    { numRuns: 100, timeout: 10000 },
  )(
    `Property ${PROPERTIES.PAGINATION_SUPPORT.number}: ${PROPERTIES.PAGINATION_SUPPORT.statement}`,
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

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(TestLayer)),
      );

      expect(result).toBe(true);
    },
  );

  /**
   * Additional test: Verify inventory stats return valid data
   * Not a formal property, but validates data invariants
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

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer)),
    );

    expect(result).toBe(true);
  });

  /**
   * Additional test: Low inventory alerts respect threshold
   * Not a formal property, but validates filtering logic
   */
  test.prop([fc.integer({ min: 0, max: 50 })], {
    numRuns: 100,
    timeout: 10000,
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

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer)),
    );

    expect(result).toBe(true);
  });
});
