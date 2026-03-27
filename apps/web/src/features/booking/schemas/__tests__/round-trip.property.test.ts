/**
 * Feature: web-booking-app, Property 17: API Schema round-trip
 *
 * For any valid SearchParams or PassengerInput, encoding then decoding
 * via Effect Schema should produce a value equivalent to the original.
 */

import { faker } from "@faker-js/faker";
import { fc, test } from "@fast-check/vitest";
import { PassengerInput, SearchParams } from "@workspace/application/booking-types";
import { Schema } from "effect";
import { describe, expect } from "vitest";

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
  .date({
    min: new Date("2020-01-01T00:00:00Z"),
    max: new Date("2024-12-31T23:59:59Z"),
  })
  .filter((d) => !Number.isNaN(d.getTime()))
  .map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()))
  .filter((d) => !Number.isNaN(d.getTime()));

const futureDateStrArb = fc
  .date({
    min: new Date("2026-03-01T00:00:00Z"),
    max: new Date("2029-12-31T23:59:59Z"),
  })
  .filter((d) => !Number.isNaN(d.getTime()))
  .map((d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

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

// Use fc.constantFrom with a set of faker values to keep it deterministic and shrinkable
const firstNames = Array.from({ length: 50 }, () => faker.person.firstName());
const lastNames = Array.from({ length: 50 }, () => faker.person.lastName());
const emails = Array.from({ length: 50 }, () => faker.internet.email());

const firstNameArb = fc.constantFrom(...firstNames);
const lastNameArb = fc.constantFrom(...lastNames);
const emailArb = fc.constantFrom(...emails);

const passengerInputArb = fc.record({
  firstName: firstNameArb,
  lastName: lastNameArb,
  email: emailArb,
  dateOfBirth: pastDateArb,
  gender: fc.constantFrom("MALE" as const, "FEMALE" as const),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 17: API Schema round-trip", () => {
  test.prop([searchParamsArb], { numRuns: 100 })(
    "SearchParams encode → decode round-trip",
    (params) => {
      const decoded = Schema.decodeSync(SearchParams)(params as any) as typeof SearchParams.Type;
      const encoded = Schema.encodeSync(SearchParams)(decoded);
      const reDecoded = Schema.decodeSync(SearchParams)(encoded) as typeof SearchParams.Type;

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

  test.prop([passengerInputArb], { numRuns: 100 })(
    "PassengerInput encode → decode round-trip",
    (passenger) => {
      const encoded = Schema.encodeSync(PassengerInput)(
        passenger as PassengerInput,
      );
      const decoded = Schema.decodeSync(PassengerInput)(encoded) as PassengerInput;

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
