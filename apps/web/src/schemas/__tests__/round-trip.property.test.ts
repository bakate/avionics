/**
 * Feature: web-booking-app, Property 16: API Schema round-trip
 * Validates: Requirements 8.4
 *
 * For any valid SearchParams or PassengerInput, encoding then decoding
 * via Effect Schema should produce a value equivalent to the original.
 */

import { fc, test } from "@fast-check/vitest";
import { type AirportCode } from "@workspace/domain/kernel";
import { Option, Schema } from "effect";
import { describe, expect } from "vitest";
import { PassengerInput } from "../passenger.schema.js";
import { SearchParams } from "../search.schema.js";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const airportCodeArb = fc
  .stringOf(fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"), {
    minLength: 3,
    maxLength: 3,
  })
  .filter((s) => /^[A-Z]{3}$/.test(s));

const pastDateArb = fc
  .date({ min: new Date("1920-01-01"), max: new Date() })
  .map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()));

const futureDateArb = fc
  .date({ min: new Date("2026-03-01"), max: new Date("2028-12-31") })
  .map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()));

const searchParamsArb = fc.record({
  origin: airportCodeArb,
  destination: airportCodeArb,
  departureDate: futureDateArb,
  returnDate: fc.option(futureDateArb, { nil: undefined }),
  passengerCount: fc.integer({ min: 1, max: 9 }),
  cabinClass: fc.option(
    fc.constantFrom("ECONOMY" as const, "BUSINESS" as const, "FIRST" as const),
    { nil: undefined },
  ),
});

const emailArb = fc
  .tuple(
    fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789"), {
      minLength: 1,
      maxLength: 8,
    }),
    fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"), {
      minLength: 1,
      maxLength: 6,
    }),
    fc.constantFrom("com", "org", "fr", "net"),
  )
  .map(([user, domain, tld]) => `${user}@${domain}.${tld}`);

const passengerInputArb = fc.record({
  firstName: fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"), {
    minLength: 1,
    maxLength: 10,
  }),
  lastName: fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"), {
    minLength: 1,
    maxLength: 10,
  }),
  email: emailArb,
  dateOfBirth: pastDateArb,
  gender: fc.constantFrom("MALE" as const, "FEMALE" as const),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 16: API Schema round-trip", () => {
  test.prop([searchParamsArb], { numRuns: 20 })(
    "SearchParams encode → decode round-trip",
    (params) => {
      const encoded = Schema.encodeSync(SearchParams)({
        origin: params.origin as AirportCode,
        destination: params.destination as AirportCode,
        departureDate: params.departureDate,
        passengerCount: params.passengerCount,
        returnDate: Option.fromNullable(params.returnDate),
        cabinClass: Option.fromNullable(params.cabinClass),
      });
      const decoded = Schema.decodeSync(SearchParams)(encoded);

      expect(decoded.origin).toBe(params.origin);
      expect(decoded.destination).toBe(params.destination);
      expect(decoded.departureDate.getTime()).toBe(
        params.departureDate.getTime(),
      );
      expect(decoded.passengerCount).toBe(params.passengerCount);

      // Verify returnDate round-trip
      if (params.returnDate) {
        const decodedDate = Option.getOrThrow(decoded.returnDate);
        expect(decodedDate.getTime()).toBe(params.returnDate.getTime());
      } else {
        expect(Option.isNone(decoded.returnDate)).toBe(true);
      }

      // Verify cabinClass round-trip
      if (params.cabinClass) {
        expect(Option.getOrThrow(decoded.cabinClass)).toBe(params.cabinClass);
      } else {
        expect(Option.isNone(decoded.cabinClass)).toBe(true);
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
