/**
 * Feature: web-booking-app, Property 17: API Schema round-trip
 *
 * For any valid SearchParams or PassengerInput, encoding then decoding
 * via Effect Schema should produce a value equivalent to the original.
 */

import { fc, test } from "@fast-check/vitest";
import { Schema } from "effect";
import { describe, expect } from "vitest";
import { PassengerInput } from "../passenger.schema.js";
import { SearchParams } from "../search.schema.js";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const airportCodeArb = fc
  .string({
    minLength: 3,
    maxLength: 3,
  })
  .map((s) => s.toUpperCase())
  .filter((s) => /^[A-Z]{3}$/.test(s));

const pastDateArb = fc
  .date({ min: new Date("1920-01-01T00:00:00Z"), max: new Date() })
  .map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()));

const futureDateStrArb = fc
  .date({
    min: new Date("2026-03-01T00:00:00Z"),
    max: new Date("2028-12-31T23:59:59Z"),
  })
  .map((d) => d.toISOString().split("T")[0] ?? "");

const passengersArb = fc.record({
  adults: fc.integer({ min: 1, max: 9 }),
  children: fc.integer({ min: 0, max: 8 }),
  infants: fc.integer({ min: 0, max: 4 }),
});

const roundTripSearchParamsArb = fc.record({
  tripType: fc.constant("roundTrip" as const),
  origin: airportCodeArb,
  destination: airportCodeArb,
  departureDate: futureDateStrArb,
  returnDate: futureDateStrArb,
  passengers: passengersArb,
  cabinClass: fc.option(
    fc.constantFrom("ECONOMY" as const, "BUSINESS" as const, "FIRST" as const),
    { nil: undefined },
  ),
});

const oneWaySearchParamsArb = fc.record({
  tripType: fc.constant("oneWay" as const),
  origin: airportCodeArb,
  destination: airportCodeArb,
  departureDate: futureDateStrArb,
  passengers: passengersArb,
  cabinClass: fc.option(
    fc.constantFrom("ECONOMY" as const, "BUSINESS" as const, "FIRST" as const),
    { nil: undefined },
  ),
});

const searchParamsArb = fc.oneof(
  roundTripSearchParamsArb,
  oneWaySearchParamsArb,
);

const emailArb = fc.emailAddress();

const nameArb = fc
  .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"), {
    minLength: 1,
    maxLength: 10,
  })
  .map((arr) => arr.join(""));

const passengerInputArb = fc.record({
  firstName: nameArb,
  lastName: nameArb,
  email: emailArb,
  dateOfBirth: pastDateArb,
  gender: fc.constantFrom("MALE" as const, "FEMALE" as const),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 17: API Schema round-trip", () => {
  test.prop([searchParamsArb], { numRuns: 20 })(
    "SearchParams encode → decode round-trip",
    (params) => {
      const decoded = Schema.decodeSync(SearchParams)(params as any);
      const encoded = Schema.encodeSync(SearchParams)(decoded);
      const reDecoded = Schema.decodeSync(SearchParams)(encoded);

      expect(reDecoded.origin).toBe(params.origin);
      expect(reDecoded.destination).toBe(params.destination);
      expect(reDecoded.departureDate).toBe(params.departureDate);
      expect(reDecoded.tripType).toBe(params.tripType);
      expect(reDecoded.passengers.adults).toBe(params.passengers.adults);
      expect(reDecoded.passengers.children).toBe(params.passengers.children);
      expect(reDecoded.passengers.infants).toBe(params.passengers.infants);

      if (params.tripType === "roundTrip" && "returnDate" in params) {
        expect(reDecoded.returnDate).toBe(params.returnDate);
      }
    },
  );

  test.prop([passengerInputArb], { numRuns: 20 })(
    "PassengerInput encode → decode round-trip",
    (passenger) => {
      const encoded = Schema.encodeSync(PassengerInput)(
        passenger as PassengerInput,
      );
      const decoded = Schema.decodeSync(PassengerInput)(encoded);

      expect(decoded.firstName).toBe(passenger.firstName);
      expect(decoded.lastName).toBe(passenger.lastName);
      expect(decoded.email).toBe(passenger.email);
      expect(decoded.dateOfBirth.getTime()).toBe(
        passenger.dateOfBirth.getTime(),
      );
      expect(decoded.gender).toBe(passenger.gender);
    },
  );
});
