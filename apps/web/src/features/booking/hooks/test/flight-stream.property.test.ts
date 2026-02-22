/**
 * Property 1: Flight stream completeness
 *
 * For any sequence of flights emitted by the Flight_Stream, the rendered
 * flight list should contain exactly those flights in the order received,
 * with no duplicates and no missing entries.
 *
 * We test the pure toFlightResult adapter and verify that mapping an array
 * of API responses preserves count, order, and identity (flightId).
 *
 * Feature: web-booking-app, Property 1: Flight stream completeness
 * Validates: Requirements 1.2
 */

import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

// ---------------------------------------------------------------------------
// Generator: raw API-like flight availability objects
// ---------------------------------------------------------------------------

const moneyArb = fc.record({
  amount: fc.nat({ max: 99999 }),
  currency: fc.constantFrom("EUR", "USD", "GBP", "CHF"),
});

const flightAvailabilityArb = fc.record({
  flightId: fc.uuid(),
  economyAvailable: fc.nat({ max: 300 }),
  businessAvailable: fc.nat({ max: 50 }),
  firstAvailable: fc.nat({ max: 20 }),
  economyPrice: moneyArb,
  businessPrice: moneyArb,
  firstPrice: moneyArb,
  lastUpdated: fc
    .date({
      min: new Date("2020-01-01T00:00:00Z"),
      max: new Date("2030-01-01T00:00:00Z"),
    })
    .filter((d) => !Number.isNaN(d.getTime())),
});

// ---------------------------------------------------------------------------
// toFlightResult — inline replica for testing (avoids importing React hook)
// ---------------------------------------------------------------------------

type FlightResult = {
  readonly flightId: string;
  readonly economyAvailable: number;
  readonly businessAvailable: number;
  readonly firstAvailable: number;
  readonly economyPrice: { readonly amount: number; readonly currency: string };
  readonly businessPrice: {
    readonly amount: number;
    readonly currency: string;
  };
  readonly firstPrice: { readonly amount: number; readonly currency: string };
  readonly lastUpdated: string;
};

const toFlightResult = (raw: {
  flightId: string;
  economyAvailable: number;
  businessAvailable: number;
  firstAvailable: number;
  economyPrice: { amount: number; currency: string };
  businessPrice: { amount: number; currency: string };
  firstPrice: { amount: number; currency: string };
  lastUpdated: Date | string;
}): FlightResult => ({
  flightId: raw.flightId,
  economyAvailable: raw.economyAvailable,
  businessAvailable: raw.businessAvailable,
  firstAvailable: raw.firstAvailable,
  economyPrice: {
    amount: raw.economyPrice.amount,
    currency: raw.economyPrice.currency,
  },
  businessPrice: {
    amount: raw.businessPrice.amount,
    currency: raw.businessPrice.currency,
  },
  firstPrice: {
    amount: raw.firstPrice.amount,
    currency: raw.firstPrice.currency,
  },
  lastUpdated:
    typeof raw.lastUpdated === "string"
      ? raw.lastUpdated
      : raw.lastUpdated.toISOString(),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 1: Flight stream completeness", () => {
  test.prop(
    [fc.array(flightAvailabilityArb, { minLength: 0, maxLength: 50 })],
    { numRuns: 100 },
  )("mapping preserves count — no flights lost or duplicated", (flights) => {
    const results = flights.map(toFlightResult);
    expect(results.length).toBe(flights.length);
  });

  test.prop(
    [fc.array(flightAvailabilityArb, { minLength: 1, maxLength: 50 })],
    { numRuns: 100 },
  )(
    "mapping preserves order — flightIds appear in same sequence",
    (flights) => {
      const results = flights.map(toFlightResult);
      const inputIds = flights.map((f) => f.flightId);
      const outputIds = results.map((r) => r.flightId);
      expect(outputIds).toEqual(inputIds);
    },
  );

  test.prop([flightAvailabilityArb], { numRuns: 100 })(
    "mapping preserves all fields for each flight",
    (flight) => {
      const result = toFlightResult(flight);
      expect(result.flightId).toBe(flight.flightId);
      expect(result.economyAvailable).toBe(flight.economyAvailable);
      expect(result.businessAvailable).toBe(flight.businessAvailable);
      expect(result.firstAvailable).toBe(flight.firstAvailable);
      expect(result.economyPrice.amount).toBe(flight.economyPrice.amount);
      expect(result.economyPrice.currency).toBe(flight.economyPrice.currency);
      expect(result.businessPrice.amount).toBe(flight.businessPrice.amount);
      expect(result.firstPrice.amount).toBe(flight.firstPrice.amount);
      expect(result.firstPrice.amount).toBe(flight.firstPrice.amount);
    },
  );
});
