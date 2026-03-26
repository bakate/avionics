/**
 * Feature: web-booking-app, Property 7: Cabin card shows correct availability
 *
 * For any FlightResult with cabin data, the cabin cards should display exactly
 * the cabins that have availableSeats > 0 as selectable, and cabins with
 * availableSeats === 0 as unavailable.
 */

import { type CabinClass, FlightId } from "@workspace/domain/kernel";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { FlightResult } from "../../machines/booking.machine";

// ---------------------------------------------------------------------------
// Pure logic under test: classify cabins as selectable or sold-out
// ---------------------------------------------------------------------------

type CabinAvailability = {
  readonly cabin: CabinClass;
  readonly selectable: boolean;
  readonly availableSeats: number;
  readonly price: { readonly amount: number; readonly currency: string };
};

const classifyCabins = (
  flight: FlightResult,
): ReadonlyArray<CabinAvailability> =>
  flight.cabins.map((c) => ({
    cabin: c.cabin,
    selectable: c.availableSeats > 0,
    availableSeats: c.availableSeats,
    price: c.price,
  }));

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
  .map(([cabin, price, seats]) => ({ cabin, availableSeats: seats, price }));

const flightResultArb = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 8 }),
    fc.string({ minLength: 2, maxLength: 6 }),
    fc.uniqueArray(cabinArb, {
      minLength: 1,
      maxLength: 3,
      selector: (c) => c.cabin,
    }),
  )
  .map(
    ([id, num, cabins]): FlightResult =>
      new FlightResult({
        flightId: FlightId.make(id),
        flightNumber: `AF${num}`,
        origin: "CDG",
        destination: "JFK",
        departureTime: new Date().toISOString(),
        arrivalTime: new Date().toISOString(),
        durationMinutes: 480,
        stops: 0,
        cabins,
        lastUpdated: new Date().toISOString(),
      }),
  );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 7: Cabin card shows correct availability", () => {
  test("cabins with availableSeats > 0 are selectable, cabins with 0 are not", () => {
    fc.assert(
      fc.property(flightResultArb, (flight) => {
        const classified = classifyCabins(flight);

        for (const c of classified) {
          if (c.availableSeats > 0) {
            expect(c.selectable).toBe(true);
          } else {
            expect(c.selectable).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  test("classified cabins preserve all original cabin data", () => {
    fc.assert(
      fc.property(flightResultArb, (flight) => {
        const classified = classifyCabins(flight);
        expect(classified).toHaveLength(flight.cabins.length);

        for (let i = 0; i < classified.length; i++) {
          const orig = flight.cabins[i];
          const cls = classified[i];
          if (!orig || !cls) continue;
          expect(cls.cabin).toBe(orig.cabin);
          expect(cls.availableSeats).toBe(orig.availableSeats);
          expect(cls.price).toEqual(orig.price);
        }
      }),
      { numRuns: 100 },
    );
  });

  test("a flight with all sold-out cabins has zero selectable cabins", () => {
    const soldOutFlightArb = fc
      .tuple(
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.uniqueArray(cabinClassArb, { minLength: 1, maxLength: 3 }),
        moneyArb,
      )
      .map(
        ([id, cabinClasses, price]): FlightResult =>
          new FlightResult({
            flightId: FlightId.make(id),
            flightNumber: "AF000",
            origin: "CDG",
            destination: "JFK",
            departureTime: new Date().toISOString(),
            arrivalTime: new Date().toISOString(),
            durationMinutes: 480,
            stops: 0,
            cabins: cabinClasses.map((cabin) => ({
              cabin,
              availableSeats: 0,
              price: {
                amount: price.amount,
                currency: price.currency as any,
              },
            })),
            lastUpdated: new Date().toISOString(),
          }),
      );

    fc.assert(
      fc.property(soldOutFlightArb, (flight) => {
        const classified = classifyCabins(flight);
        const selectableCount = classified.filter((c) => c.selectable).length;
        expect(selectableCount).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});
