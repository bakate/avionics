/**
 * Feature: web-booking-app, Property 21: Date carousel price consistency
 *
 * For any date in the date carousel and the corresponding set of available
 * flights, the displayed lowest price should match the minimum cabin price
 * across all flights available on that date. If no flights exist for a date,
 * the price should be null.
 */

import { type CabinClass } from "@workspace/domain/kernel";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type FlightResult } from "../../machines/booking.machine";
import { type DatePrice } from "../date-carousel";

// ---------------------------------------------------------------------------
// Pure logic under test: compute lowest price per date from flights
// ---------------------------------------------------------------------------

const computeDatePrices = (
  dates: ReadonlyArray<string>,
  flights: ReadonlyArray<FlightResult>,
): ReadonlyArray<DatePrice> =>
  dates.map((date) => {
    const dayFlights = flights.filter(
      (f) => f.departureTime.slice(0, 10) === date,
    );
    if (dayFlights.length === 0) return { date, lowestPrice: null };

    let minAmount = Number.POSITIVE_INFINITY;
    let currency = "EUR";
    for (const f of dayFlights) {
      for (const c of f.cabins) {
        if (c.availableSeats > 0 && c.price.amount < minAmount) {
          minAmount = c.price.amount;
          currency = c.price.currency;
        }
      }
    }
    return minAmount === Number.POSITIVE_INFINITY
      ? { date, lowestPrice: null }
      : { date, lowestPrice: { amount: minAmount, currency } };
  });

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

/** Generate a date string YYYY-MM-DD */
const dateArb = fc.integer({ min: 0, max: 6 }).map((offset) => {
  const d = new Date(2026, 5, 15 + offset);
  return d.toISOString().slice(0, 10);
});

/** Generate a FlightResult departing on a given date */
const flightOnDateArb = (date: string) =>
  fc
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
      ([id, num, cabins]): FlightResult => ({
        flightId: id,
        flightNumber: `AF${num}`,
        origin: "CDG",
        destination: "JFK",
        departureTime: `${date}T10:00:00.000Z`,
        arrivalTime: `${date}T18:00:00.000Z`,
        durationMinutes: 480,
        stops: 0,
        cabins,
        lastUpdated: new Date().toISOString(),
      }),
    );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 21: Date carousel price consistency", () => {
  test("lowest price matches minimum available cabin price across flights on that date", () => {
    fc.assert(
      fc.property(
        fc.array(dateArb, { minLength: 1, maxLength: 7 }).chain((dates) => {
          const uniqueDates = [...new Set(dates)];
          return fc.tuple(
            fc.constant(uniqueDates),
            fc.array(
              fc.constantFrom(...uniqueDates).chain((d) => flightOnDateArb(d)),
              { minLength: 0, maxLength: 10 },
            ),
          );
        }),
        ([dates, flights]) => {
          const result = computeDatePrices(dates, flights);

          for (const dp of result) {
            const dayFlights = flights.filter(
              (f) => f.departureTime.slice(0, 10) === dp.date,
            );

            // Collect all available cabin prices for this date
            const availablePrices: Array<number> = [];
            for (const f of dayFlights) {
              for (const c of f.cabins) {
                if (c.availableSeats > 0) {
                  availablePrices.push(c.price.amount);
                }
              }
            }

            if (availablePrices.length === 0) {
              expect(dp.lowestPrice).toBeNull();
            } else {
              expect(dp.lowestPrice).not.toBeNull();
              expect(dp.lowestPrice?.amount).toBe(Math.min(...availablePrices));
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test("dates with no flights produce null price", () => {
    fc.assert(
      fc.property(dateArb, (date) => {
        const result = computeDatePrices([date], []);
        expect(result).toHaveLength(1);
        expect(result[0]?.lowestPrice).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  test("dates with only sold-out flights produce null price", () => {
    fc.assert(
      fc.property(dateArb, (date) => {
        const soldOutFlight: FlightResult = {
          flightId: "sold-out",
          flightNumber: "AF000",
          origin: "CDG",
          destination: "JFK",
          departureTime: `${date}T10:00:00.000Z`,
          arrivalTime: `${date}T18:00:00.000Z`,
          durationMinutes: 480,
          stops: 0,
          cabins: [
            {
              cabin: "ECONOMY",
              availableSeats: 0,
              price: { amount: 500, currency: "EUR" },
            },
          ],
          lastUpdated: new Date().toISOString(),
        };
        const result = computeDatePrices([date], [soldOutFlight]);
        expect(result).toHaveLength(1);
        expect(result[0]?.lowestPrice).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
