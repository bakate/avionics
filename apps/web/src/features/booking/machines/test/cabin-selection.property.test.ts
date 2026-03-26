/**
 * Feature: web-booking-app, Property 6: Cabin selection creates correct FlightSelection
 *
 * For any FlightResult and any available cabin in that flight, selecting that
 * cabin should produce a FlightSelection containing the correct FlightResult,
 * CabinClass, and price matching the cabin data.
 */

import { type CabinClass, FlightId } from "@workspace/domain/kernel";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { createFlightSelection, FlightResult } from "../booking.machine";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const cabinClassArb = fc.constantFrom<CabinClass>(
  "ECONOMY",
  "BUSINESS",
  "FIRST",
);

const moneyArb = fc.record({
  amount: fc.integer({ min: 1, max: 99999 }),
  currency: fc.constantFrom("EUR", "USD", "GBP"),
});

const cabinArb = fc
  .tuple(cabinClassArb, moneyArb, fc.integer({ min: 0, max: 300 }))
  .map(([cabin, price, seats]) => ({
    cabin,
    availableSeats: seats,
    price,
  }));

/** Generate a FlightResult with 1-3 unique cabins */
const flightResultArb = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 10 }),
    fc.string({ minLength: 2, maxLength: 6 }),
    fc.constantFrom("CDG", "JFK", "LHR", "NRT"),
    fc.constantFrom("LAX", "ORD", "FRA", "SIN"),
    fc.integer({ min: 60, max: 900 }),
    fc.integer({ min: 0, max: 3 }),
    fc.uniqueArray(cabinArb, {
      minLength: 1,
      maxLength: 3,
      selector: (c) => c.cabin,
    }),
  )
  .map(
    ([id, flightNum, origin, dest, duration, stops, cabins]): FlightResult =>
      new FlightResult({
        flightId: FlightId.make(id),
        flightNumber: `AF${flightNum}`,
        origin,
        destination: dest,
        departureTime: new Date().toISOString(),
        arrivalTime: new Date().toISOString(),
        durationMinutes: duration,
        stops,
        cabins,
        lastUpdated: new Date().toISOString(),
      }),
  );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 6: Cabin selection creates correct FlightSelection", () => {
  test("selecting an available cabin produces a FlightSelection with matching flight, cabin, and price", () => {
    fc.assert(
      fc.property(flightResultArb, (flight) => {
        for (const cabinData of flight.cabins) {
          const selection = createFlightSelection(flight, cabinData.cabin);

          expect(selection).not.toBeNull();
          expect(selection?.flight).toBe(flight);
          expect(selection?.cabin).toBe(cabinData.cabin);
          expect(selection?.price).toEqual(cabinData.price);
        }
      }),
      { numRuns: 100 },
    );
  });

  test("selecting a cabin not present in the flight returns null", () => {
    fc.assert(
      fc.property(flightResultArb, cabinClassArb, (flight, cabin) => {
        const hasCabin = flight.cabins.some((c) => c.cabin === cabin);
        if (!hasCabin) {
          const selection = createFlightSelection(flight, cabin);
          expect(selection).toBeNull();
        }
      }),
      { numRuns: 100 },
    );
  });

  test("FlightSelection price matches the exact cabin price data", () => {
    fc.assert(
      fc.property(flightResultArb, (flight) => {
        for (const cabinData of flight.cabins) {
          const selection = createFlightSelection(flight, cabinData.cabin);
          if (selection) {
            expect(selection.price.amount).toBe(cabinData.price.amount);
            expect(selection.price.currency).toBe(cabinData.price.currency);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
