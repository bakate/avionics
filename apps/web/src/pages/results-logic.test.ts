import * as fc from "fast-check";
import { describe, it } from "vitest";
import { type FlightResult } from "../features/booking/machines/booking.machine";
import { filterFlights, sortFlights } from "./results-logic";

// Arbitraries
const safeDateStr = fc
  .integer({
    min: new Date("2020-01-01T00:00:00Z").getTime(),
    max: new Date("2030-01-01T00:00:00Z").getTime(),
  })
  .map((t) => new Date(t).toISOString());

const flightArbitrary = fc.record<FlightResult>({
  flightId: fc.uuid(),
  flightNumber: fc.stringMatching(/^[A-Z]{2}\d{4}$/),
  departureTime: safeDateStr,
  arrivalTime: safeDateStr,
  durationMinutes: fc.integer({ min: 30, max: 1500 }),
  stops: fc.integer({ min: 0, max: 2 }),
  economyAvailable: fc.integer({ min: 0, max: 100 }),
  businessAvailable: fc.integer({ min: 0, max: 100 }),
  firstAvailable: fc.integer({ min: 0, max: 100 }),
  economyPrice: fc.record({
    amount: fc.integer({ min: 50, max: 5000 }),
    currency: fc.constant("EUR"),
  }),
  businessPrice: fc.record({
    amount: fc.integer({ min: 200, max: 10000 }),
    currency: fc.constant("EUR"),
  }),
  firstPrice: fc.record({
    amount: fc.integer({ min: 500, max: 20000 }),
    currency: fc.constant("EUR"),
  }),
  lastUpdated: safeDateStr,
});

describe("results-logic", () => {
  describe("filterFlights", () => {
    it("should correctly filter by max stops", () => {
      fc.assert(
        fc.property(
          fc.array(flightArbitrary),
          fc.integer({ min: 0, max: 2 }),
          (flights, maxStops) => {
            const filtered = filterFlights(flights, {
              cabinClass: "ECONOMY",
              maxStops,
              timeRange: null,
            });
            return filtered.every((f) => f.stops <= maxStops);
          },
        ),
      );
    });

    it("should correctly filter by time range", () => {
      fc.assert(
        fc.property(
          fc.array(flightArbitrary),
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 23 }),
          (flights, h1, h2) => {
            const min = Math.min(h1, h2);
            const max = Math.max(h1, h2);
            if (min === max) return true;

            const filtered = filterFlights(flights, {
              cabinClass: "ECONOMY",
              maxStops: null,
              timeRange: [min, max],
            });
            return filtered.every((f) => {
              const hour = new Date(f.departureTime).getHours();
              return hour >= min && hour < max;
            });
          },
        ),
      );
    });

    it("should correctly filter by cabin availability", () => {
      fc.assert(
        fc.property(
          fc.array(flightArbitrary),
          fc.constantFrom("ECONOMY", "BUSINESS", "FIRST") as fc.Arbitrary<
            "ECONOMY" | "BUSINESS" | "FIRST"
          >,
          (flights, cabin) => {
            const filtered = filterFlights(flights, {
              cabinClass: cabin,
              maxStops: null,
              timeRange: null,
            });
            return filtered.every((f) => {
              if (cabin === "ECONOMY") return f.economyAvailable > 0;
              if (cabin === "BUSINESS") return f.businessAvailable > 0;
              return f.firstAvailable > 0;
            });
          },
        ),
      );
    });
  });

  describe("sortFlights", () => {
    it("should sort by price ascending", () => {
      fc.assert(
        fc.property(fc.array(flightArbitrary, { minLength: 1 }), (flights) => {
          const sorted = sortFlights(flights, "price", "asc", "ECONOMY");
          for (let i = 0; i < sorted.length - 1; i++) {
            const a = sorted[i];
            const b = sorted[i + 1];
            if (!a || !b) continue;
            if (a.economyPrice.amount > b.economyPrice.amount) return false;
          }
          return true;
        }),
      );
    });

    it("should sort by price descending", () => {
      fc.assert(
        fc.property(fc.array(flightArbitrary, { minLength: 1 }), (flights) => {
          const sorted = sortFlights(flights, "price", "desc", "ECONOMY");
          for (let i = 0; i < sorted.length - 1; i++) {
            const a = sorted[i];
            const b = sorted[i + 1];
            if (!a || !b) continue;
            if (a.economyPrice.amount < b.economyPrice.amount) return false;
          }
          return true;
        }),
      );
    });

    it("should sort by departure ascending", () => {
      fc.assert(
        fc.property(fc.array(flightArbitrary, { minLength: 1 }), (flights) => {
          const sorted = sortFlights(flights, "departure", "asc", "ECONOMY");
          for (let i = 0; i < sorted.length - 1; i++) {
            const a = sorted[i];
            const b = sorted[i + 1];
            if (!a || !b) continue;
            if (
              new Date(a.departureTime).getTime() >
              new Date(b.departureTime).getTime()
            )
              return false;
          }
          return true;
        }),
      );
    });

    it("should sort by duration", () => {
      fc.assert(
        fc.property(fc.array(flightArbitrary, { minLength: 1 }), (flights) => {
          const sorted = sortFlights(flights, "duration", "asc", "ECONOMY");
          for (let i = 0; i < sorted.length - 1; i++) {
            const a = sorted[i];
            const b = sorted[i + 1];
            if (!a || !b) continue;
            if (a.durationMinutes > b.durationMinutes) return false;
          }
          return true;
        }),
      );
    });
  });
});
