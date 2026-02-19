/**
 * @file booking-summary.property.test.ts
 * @description Property-based test for BookingSummary correctness
 * Feature: multi-passenger-pricing, Property 8: BookingSummary reflects correct passenger count and total price
 */

import { BookingQueries } from "@workspace/application/booking-queries";
import { BookingSummary } from "@workspace/application/read-models";
import { BookingPersistenceError } from "@workspace/domain/errors";
import {
  type CurrencyCode,
  Money,
  type PassengerType,
} from "@workspace/domain/kernel";
import { computePricingBreakdown } from "@workspace/domain/pricing";
import { Effect, Schema } from "effect";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { PostgresBookingQueriesTest } from "../../../queries/booking-queries.js";

// =============================================================================
// Arbitraries
// =============================================================================

const arbCurrency = fc.constantFrom(
  "EUR",
  "USD",
  "GBP",
  "CHF",
) as fc.Arbitrary<CurrencyCode>;

const arbPassengerType = fc.constantFrom(
  "INFANT",
  "CHILD",
  "YOUNG_ADULT",
  "ADULT",
  "SENIOR",
) as fc.Arbitrary<PassengerType>;

const arbPassengerInput = fc.record({
  id: fc.uuid(),
  type: arbPassengerType,
});

const arbNonEmptyPassengers = fc.array(arbPassengerInput, {
  minLength: 1,
  maxLength: 9,
});

const arbBasePrice = fc
  .record({
    amount: fc.integer({ min: 1, max: 100_000 }),
    currency: arbCurrency,
  })
  .map(({ amount, currency }) => Money.of(amount, currency));

// =============================================================================
// Property Tests
// =============================================================================

describe("BookingSummary Property Tests", () => {
  /**
   * Feature: multi-passenger-pricing, Property 8: BookingSummary reflects correct passenger count and total price
   *
   * For any Booking with N passengers and a computed PricingBreakdown,
   * the derived BookingSummary should have passengerCount === N
   * and totalPrice matching the breakdown's total.
   */
  test("Property 8: BookingSummary reflects correct passenger count and total price", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.stringMatching(/^[A-Z0-9]{6}$/),
        arbNonEmptyPassengers,
        arbBasePrice,
        async (bookingId, pnrCode, passengers, basePrice) => {
          const breakdown = computePricingBreakdown(passengers, basePrice);
          const passengerCount = passengers.length;

          const layer = PostgresBookingQueriesTest({
            getSummaryByPnr: () =>
              Schema.decodeUnknown(BookingSummary)({
                id: bookingId,
                pnrCode,
                status: "Held",
                passengerCount,
                totalPrice: {
                  amount: breakdown.totalPrice.amount,
                  currency: breakdown.totalPrice.currency,
                },
                createdAt: new Date().toISOString(),
                expiresAt: null,
              }).pipe(
                Effect.mapError(
                  (error) =>
                    new BookingPersistenceError({
                      bookingId,
                      reason: `Failed to decode: ${error.message}`,
                    }),
                ),
              ),
          });

          const program = Effect.gen(function* () {
            const queries = yield* BookingQueries;
            const summary = yield* queries.getSummaryByPnr(pnrCode as any);

            expect(summary.passengerCount).toBe(passengerCount);
            expect(summary.totalPrice.amount).toBe(breakdown.totalPrice.amount);
            expect(summary.totalPrice.currency).toBe(
              breakdown.totalPrice.currency,
            );

            return true;
          });

          const result = await Effect.runPromise(
            program.pipe(Effect.provide(layer)),
          );
          expect(result).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
