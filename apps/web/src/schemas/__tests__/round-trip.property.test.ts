/**
 * Feature: web-booking-app, Property 16: API Schema round-trip
 * Validates: Requirements 7.3, 7.4
 *
 * Ensures that our frontend schemas correctly encode and decode
 * data, specifically handling branded types and optional fields.
 */

import { fc, test } from "@fast-check/vitest";
import { type AirportCode } from "@workspace/domain/kernel";
import { Schema } from "effect";
import { describe, expect } from "vitest";
import { PassengerInput } from "../passenger.schema.ts";
import { SearchParams } from "../search.schema.ts";

// Arbitraries
const airportCodeArb = fc.stringMatching(/^[A-Z]{3}$/);

const searchParamsArb = fc.record({
  origin: airportCodeArb,
  destination: airportCodeArb,
  departureDate: fc.date().map((d: Date) => d.toISOString().substring(0, 10)),
  returnDate: fc.option(
    fc.date().map((d: Date) => d.toISOString().substring(0, 10)),
    { nil: undefined },
  ),
  passengers: fc.integer({ min: 1, max: 9 }),
  cabinClass: fc.option(
    fc.constantFrom(
      "economy" as const,
      "premium" as const,
      "business" as const,
      "first" as const,
    ),
    { nil: undefined },
  ),
});

const passengerInputArb = fc.record({
  firstName: fc.string({ minLength: 1 }),
  lastName: fc.string({ minLength: 1 }),
  email: fc.emailAddress(),
  dateOfBirth: fc.date().map((d: Date) => d.toISOString().substring(0, 10)),
  gender: fc.constantFrom("male" as const, "female" as const),
});

describe("Property 16: API Schema round-trip", () => {
  test.prop([searchParamsArb], { numRuns: 20 })(
    "SearchParams encode → decode round-trip",
    (params: {
      origin: string;
      destination: string;
      departureDate: string;
      returnDate?: string | undefined;
      passengers: number;
      cabinClass?: "economy" | "premium" | "business" | "first" | undefined;
    }) => {
      const encoded = Schema.encodeSync(SearchParams)({
        ...params,
        origin: params.origin as AirportCode,
        destination: params.destination as AirportCode,
      });
      const decoded = Schema.decodeSync(SearchParams)(encoded);

      expect(decoded.origin).toBe(params.origin);
      expect(decoded.destination).toBe(params.destination);
      expect(decoded.departureDate).toBe(params.departureDate);
      expect(decoded.returnDate).toBe(params.returnDate);
      expect(decoded.passengers).toBe(params.passengers);
      expect(decoded.cabinClass).toBe(params.cabinClass);
    },
  );

  test.prop([passengerInputArb], { numRuns: 20 })(
    "PassengerInput encode → decode round-trip",
    (passenger: {
      firstName: string;
      lastName: string;
      email: string;
      dateOfBirth: string;
      gender: "male" | "female";
    }) => {
      const encoded = Schema.encodeSync(PassengerInput)(passenger);
      const decoded = Schema.decodeSync(PassengerInput)(encoded);

      expect(decoded.firstName).toBe(passenger.firstName);
      expect(decoded.lastName).toBe(passenger.lastName);
      expect(decoded.email).toBe(passenger.email);
      expect(decoded.dateOfBirth).toBe(passenger.dateOfBirth);
      expect(decoded.gender).toBe(passenger.gender);
    },
  );
});
