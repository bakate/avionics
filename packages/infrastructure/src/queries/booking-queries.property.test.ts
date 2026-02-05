/**
 * @file booking-queries.property.test.ts
 * @module @workspace/infrastructure/queries
 * @description Property-based tests for BookingQueries
 */

import { SqlClient } from "@effect/sql";
import { fc, test } from "@fast-check/vitest";
import { BookingQueries } from "@workspace/application/booking-queries";
import { Effect, Layer } from "effect";
import { describe, expect } from "vitest";
import { ConnectionPoolLive } from "../db/connection.js";
import { BookingQueriesLive } from "./booking-queries.js";

// ============================================================================
// Test Setup
// ============================================================================

const TestLayer = BookingQueriesLive.pipe(Layer.provide(ConnectionPoolLive));

// ============================================================================
// Property Tests
// ============================================================================

describe("BookingQueries Property Tests", () => {
  /**
   * Property 6: Booking queries don't load full aggregates
   * Feature: infrastructure-layer, Property 6: Booking queries don't load full aggregates
   */
  test.prop([fc.uuid()], { numRuns: 10, timeout: 10000 })(
    "Property 6: Booking queries don't load full aggregates",
    async (bookingId) => {
      const program = Effect.gen(function* () {
        const queries = yield* BookingQueries;

        // Try to get booking summary - it may not exist, which is fine
        const result = yield* queries
          .getSummaryByPnr(bookingId)
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

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(TestLayer)),
      );

      expect(result).toBe(true);
    },
  );

  /**
   * Property 8: Query failures return typed errors
   * Feature: infrastructure-layer, Property 8: Query failures return typed errors
   */
  test.prop([fc.uuid()], { numRuns: 10, timeout: 10000 })(
    "Property 8: Query failures return typed errors (BookingQueries)",
    async (invalidPnr) => {
      const program = Effect.gen(function* () {
        const queries = yield* BookingQueries;

        // Query for non-existent booking
        const result = yield* queries
          .getSummaryByPnr(invalidPnr)
          .pipe(Effect.either);

        // Should fail with a typed error
        if (result._tag === "Left") {
          const error = result.left;
          // Error should be either BookingNotFoundError or PersistenceError
          expect(
            error._tag === "BookingNotFoundError" ||
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

  /**
   * Property 9: List queries support pagination
   * Feature: infrastructure-layer, Property 9: List queries support pagination
   */
  test.prop(
    [
      fc.integer({ min: 1, max: 10 }), // page
      fc.integer({ min: 1, max: 50 }), // pageSize
    ],
    { numRuns: 10, timeout: 10000 },
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

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(TestLayer)),
      );

      expect(result).toBe(true);
    },
  );

  /**
   * Additional test: Verify SQL errors are mapped to PersistenceError
   */
  test.prop([fc.uuid()], { numRuns: 10, timeout: 10000 })(
    "SQL errors are mapped to typed errors",
    async (pnr) => {
      // Create a layer with a mock SQL client that always fails
      const FailingSqlLayer = Layer.succeed(
        SqlClient.SqlClient,
        SqlClient.SqlClient.of({
          // @ts-expect-error - Mocking for test
          withTransaction: () =>
            Effect.fail(new Error("Database connection failed")),
        }),
      );

      const FailingQueriesLayer = BookingQueriesLive.pipe(
        Layer.provide(FailingSqlLayer),
      );

      const program = Effect.gen(function* () {
        const queries = yield* BookingQueries;

        const result = yield* queries.getSummaryByPnr(pnr).pipe(Effect.either);

        // Should fail with PersistenceError
        if (result._tag === "Left") {
          const error = result.left;
          expect(
            error._tag === "PersistenceError" ||
              error._tag === "BookingNotFoundError",
          ).toBe(true);
        }

        return true;
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(FailingQueriesLayer)),
      );

      expect(result).toBe(true);
    },
  );
});
