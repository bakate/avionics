/**
 * Feature: web-booking-app, Property 8: Total price invariant
 * Validates: Requirement 7.1
 *
 * For any outbound selection price, return selection price (if applicable),
 * and total passenger count (adults + children + infants), the displayed
 * total price should equal (outbound price + return price) × total passenger count.
 */

import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";
import { calculateTotalPrice } from "../format";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const priceArb = fc.record({
  amount: fc.integer({ min: 1, max: 100_000 }),
  currency: fc.constantFrom("EUR", "USD", "GBP", "CHF"),
});

const passengersArb = fc.record({
  adults: fc.integer({ min: 1, max: 9 }),
  children: fc.integer({ min: 0, max: 8 }),
  infants: fc.integer({ min: 0, max: 4 }),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 8: Total price invariant", () => {
  test.prop([priceArb, priceArb, passengersArb], { numRuns: 100 })(
    "round-trip total = (outbound + return) × passenger count",
    (outboundPrice, returnPrice, passengers) => {
      const totalPassengers =
        passengers.adults + passengers.children + passengers.infants;

      const result = calculateTotalPrice({
        outboundPrice,
        returnPrice,
        passengerCount: totalPassengers,
      });

      const expected =
        (outboundPrice.amount + returnPrice.amount) * totalPassengers;

      expect(result.amount).toBe(expected);
      expect(result.currency).toBe(outboundPrice.currency);
    },
  );

  test.prop([priceArb, passengersArb], { numRuns: 100 })(
    "one-way total = outbound × passenger count",
    (outboundPrice, passengers) => {
      const totalPassengers =
        passengers.adults + passengers.children + passengers.infants;

      const result = calculateTotalPrice({
        outboundPrice,
        returnPrice: null,
        passengerCount: totalPassengers,
      });

      const expected = outboundPrice.amount * totalPassengers;

      expect(result.amount).toBe(expected);
      expect(result.currency).toBe(outboundPrice.currency);
    },
  );

  test.prop([priceArb, fc.option(priceArb, { nil: null })], { numRuns: 100 })(
    "single passenger total = outbound + return (no multiplication effect)",
    (outboundPrice, returnPrice) => {
      const result = calculateTotalPrice({
        outboundPrice,
        returnPrice,
        passengerCount: 1,
      });

      const expected = outboundPrice.amount + (returnPrice?.amount ?? 0);

      expect(result.amount).toBe(expected);
    },
  );
});
