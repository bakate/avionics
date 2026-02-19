/**
 * Property-Based Tests for PricingEngine
 * Feature: multi-passenger-pricing
 */

import { fc } from "@fast-check/vitest";
import { Schema } from "effect";
import { describe, expect, test } from "vitest";
import {
  type CurrencyCode,
  Money,
  type PassengerType,
} from "../../../kernel.js";
import {
  computePassengerFare,
  computePricingBreakdown,
  countSeatsNeeded,
  PASSENGER_MULTIPLIERS,
  PricingBreakdown,
} from "../../../pricing/pricing-engine.js";

// =============================================================================
// Arbitraries
// =============================================================================

const arbCurrency = fc.constantFrom(
  "EUR",
  "USD",
  "GBP",
  "CHF",
) as fc.Arbitrary<CurrencyCode>;

const arbBasePrice = fc
  .record({
    amount: fc.integer({ min: 0, max: 100_000 }),
    currency: arbCurrency,
  })
  .map(({ amount, currency }) => Money.of(amount, currency));

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

// =============================================================================
// Property Tests
// =============================================================================

describe("PricingEngine - Property-Based Tests", () => {
  /**
   * Feature: multi-passenger-pricing, Property 2: Pricing multiplier correctness
   */
  test("Property 2: For any PassengerType and base price, the fare equals basePrice * defined multiplier", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        arbPassengerType,
        arbBasePrice,
        (passengerId, type, basePrice) => {
          const fare = computePassengerFare(passengerId, type, basePrice);

          const expectedMultiplier = PASSENGER_MULTIPLIERS[type];
          expect(fare.multiplier).toBe(expectedMultiplier);
          expect(fare.finalPrice.amount).toBe(
            Math.round(basePrice.amount * expectedMultiplier),
          );
          expect(fare.finalPrice.currency).toBe(basePrice.currency);
          expect(fare.basePrice.amount).toBe(basePrice.amount);
          expect(fare.passengerType).toBe(type);
          expect(fare.passengerId).toBe(passengerId);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: multi-passenger-pricing, Property 3: Total price is sum of individual fares
   */
  test("Property 3: For any passengers and base price, totalPrice equals sum of individual finalPrices", () => {
    fc.assert(
      fc.property(
        arbNonEmptyPassengers,
        arbBasePrice,
        (passengers, basePrice) => {
          const breakdown = computePricingBreakdown(passengers, basePrice);

          const expectedTotal = breakdown.fares.reduce(
            (sum, fare) => sum + fare.finalPrice.amount,
            0,
          );

          expect(breakdown.totalPrice.amount).toBe(expectedTotal);
          expect(breakdown.totalPrice.currency).toBe(basePrice.currency);
          expect(breakdown.fares.length).toBe(passengers.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: multi-passenger-pricing, Property 4: Pricing breakdown round-trip
   */
  test("Property 4: For any valid PricingBreakdown, encoding then decoding produces an equivalent object", () => {
    const encode = Schema.encodeSync(Schema.parseJson(PricingBreakdown));
    const decode = Schema.decodeSync(Schema.parseJson(PricingBreakdown));

    fc.assert(
      fc.property(
        arbNonEmptyPassengers,
        arbBasePrice,
        (passengers, basePrice) => {
          const original = computePricingBreakdown(passengers, basePrice);
          const json = encode(original);
          const restored = decode(json);

          expect(restored.totalPrice.amount).toBe(original.totalPrice.amount);
          expect(restored.totalPrice.currency).toBe(
            original.totalPrice.currency,
          );
          expect(restored.fares.length).toBe(original.fares.length);

          for (const [i, originalFare] of original.fares.entries()) {
            const restoredFare = restored.fares[i];
            expect(restoredFare).toBeDefined();
            if (!restoredFare) return;
            expect(restoredFare.passengerId).toBe(originalFare.passengerId);
            expect(restoredFare.passengerType).toBe(originalFare.passengerType);
            expect(restoredFare.multiplier).toBe(originalFare.multiplier);
            expect(restoredFare.finalPrice.amount).toBe(
              originalFare.finalPrice.amount,
            );
            expect(restoredFare.basePrice.amount).toBe(
              originalFare.basePrice.amount,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: multi-passenger-pricing, Property 5: Seat hold count equals non-INFANT passengers
   */
  test("Property 5: For any passenger list, countSeatsNeeded equals count of non-INFANT passengers", () => {
    fc.assert(
      fc.property(arbNonEmptyPassengers, (passengers) => {
        const seats = countSeatsNeeded(passengers);
        const expected = passengers.filter((p) => p.type !== "INFANT").length;

        expect(seats).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });
});
