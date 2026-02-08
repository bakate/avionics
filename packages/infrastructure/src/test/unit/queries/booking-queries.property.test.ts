/**
 * @file booking-queries.property.test.ts
 * @module @workspace/infrastructure/queries
 * @description Property-based tests for BookingQueries
 */

import { SqlClient } from "@effect/sql";
import { fc, test } from "@fast-check/vitest";
import { BookingQueries } from "@workspace/application/booking-queries";
import { type PnrCode } from "@workspace/domain/kernel";
import { Effect, Layer, ManagedRuntime } from "effect";
import { describe, expect } from "vitest";
import { ConnectionPoolLive } from "../../../db/connection.js";
import { PostgresBookingQueries } from "../../../queries/booking-queries.js";

// ============================================================================
// Test Setup
// ============================================================================

const TestLayer = PostgresBookingQueries.Live.pipe(
  Layer.provideMerge(ConnectionPoolLive),
);

// Create a persistent runtime for all tests in this file
const runtime = ManagedRuntime.make(TestLayer);

// ============================================================================
// Property Tests
// ============================================================================

describe("BookingQueries Property Tests", () => {
  /**
   * Property 6: Booking queries don't load full aggregates
   * Feature: infrastructure-layer, Property 6: Booking queries don't load full aggregates
   */
  test.prop([fc.uuid()], { numRuns: 10, timeout: 30000 })(
    "Property 6: Booking queries don't load full aggregates",
    async (bookingId) => {
      const program = Effect.gen(function* () {
        const queries = yield* BookingQueries;

        // Try to get booking summary - it may not exist, which is fine
        const result = yield* queries
          .getSummaryByPnr(bookingId as PnrCode)
          .pipe(Effect.either);

        // If successful, verify no domain events property exists
        if (result._tag === "Right") {
          const summary = result.right;
          // BookingSummary should not have domainEvents property
          expect(summary).not.toHaveProperty("domainEvents");
          expect(summary).not.toHaveProperty("clearEvents");
          expect(summary).not.toHaveProperty("addEvent");
        }

        return true;
      });

      const result = await runtime.runPromise(program);
      expect(result).toBe(true);
    },
  );

  /**
   * Property 8: Query failures return typed errors
   * Feature: infrastructure-layer, Property 8: Query failures return typed errors
   */
  test.prop([fc.uuid()], { numRuns: 10, timeout: 30000 })(
    "Property 8: Query failures return typed errors (BookingQueries)",
    async (invalidPnr) => {
      const program = Effect.gen(function* () {
        const queries = yield* BookingQueries;

        // Query for non-existent booking
        const result = yield* queries
          .getSummaryByPnr(invalidPnr as PnrCode)
          .pipe(Effect.either);

        // Should fail with a typed error
        expect(result._tag).toBe("Left");
        if (result._tag === "Left") {
          const error = result.left;
          // Error should be either BookingNotFoundError, BookingPersistenceError or PersistenceError
          expect([
            "BookingNotFoundError",
            "BookingPersistenceError",
            "PersistenceError",
          ]).toContain(error._tag);
        }

        return true;
      });

      const result = await runtime.runPromise(program);
      expect(result).toBe(true);
    },
  );

  /**
   * Property 9: List queries support pagination
   * Feature: infrastructure-layer, Property 9: List queries support pagination
   */
  test.prop(
    [
      fc.integer({ min: 1, max: 10 }), // page
      fc.integer({ min: 1, max: 50 }), // pageSize
    ],
    { numRuns: 10, timeout: 30000 },
  )(
    "Property 9: List queries support pagination (BookingQueries)",
    async (page, pageSize) => {
      const program = Effect.gen(function* () {
        const queries = yield* BookingQueries;

        const result = yield* queries.listBookings({
          page,
          pageSize,
        });

        // Verify pagination parameters are respected
        expect(result.page).toBe(page);
        expect(result.pageSize).toBe(pageSize);

        // Items should not exceed page size
        expect(result.items.length).toBeLessThanOrEqual(pageSize);

        // Total should be non-negative
        expect(result.total).toBeGreaterThanOrEqual(0);

        return true;
      });

      const result = await runtime.runPromise(program);
      expect(result).toBe(true);
    },
  );

  /**
   * Additional test: Verify SQL errors are mapped to PersistenceError
   */
  test.prop([fc.uuid()], { numRuns: 10, timeout: 30000 })(
    "SQL errors are mapped to typed errors",
    async (pnr) => {
      // Create a layer with a mock SQL client that always fails
      const makeFailingDataClient = () => {
        const fn = () =>
          Effect.fail({
            _tag: "SqlError",
            message: "Database connection failed",
          });
        fn.safe = fn;
        fn.withTransaction = () =>
          Effect.fail({
            _tag: "SqlError",
            message: "Database connection failed",
          });
        return fn;
      };

      const FailingSqlLayer = Layer.succeed(
        SqlClient.SqlClient,
        makeFailingDataClient() as unknown as SqlClient.SqlClient,
      );

      const FailingQueriesLayer = PostgresBookingQueries.Live.pipe(
        Layer.provide(FailingSqlLayer),
      );

      const program = Effect.gen(function* () {
        const queries = yield* BookingQueries;

        const result = yield* queries
          .getSummaryByPnr(pnr as PnrCode)
          .pipe(Effect.either);

        // Should fail with BookingPersistenceError
        expect(result._tag).toBe("Left");
        if (result._tag === "Left") {
          const error = result.left;
          expect(error._tag).toBe("BookingPersistenceError");
        }

        return true;
      });

      // Verify mapping of SqlError to BookingPersistenceError
      const result = await Effect.runPromise(
        program.pipe(Effect.provide(FailingQueriesLayer)),
      );

      expect(result).toBe(true);
    },
  );
});
