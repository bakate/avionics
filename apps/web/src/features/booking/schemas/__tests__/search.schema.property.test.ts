/**
 * Feature: web-booking-app, Property 2: Search form validation rejects missing required fields
 * Validates: Requirements 1.4, 1.6
 *
 * For any combination of search form inputs where at least one required field
 * (origin, destination, departure date, or return date when trip type is round-trip)
 * is missing or empty, the validation should reject the submission and produce
 * error messages for exactly the missing fields.
 */

import { fc, test } from "@fast-check/vitest";
import { Schema } from "effect";
import { describe, expect } from "vitest";
import { SearchParams } from "../search.schema.js";

const validBase = {
  tripType: "roundTrip" as const,
  origin: "CDG",
  destination: "JFK",
  departureDate: "2026-06-15",
  returnDate: "2026-06-22",
  passengers: { adults: 1, children: 0, infants: 0 },
};

const requiredFieldSubset = fc.subarray(
  ["origin", "destination", "departureDate"] as const,
  { minLength: 1 },
);

describe("Property 2: Search form validation rejects missing required fields", () => {
  test.prop([requiredFieldSubset], { numRuns: 20 })(
    "removing any combination of required fields causes validation failure",
    (fieldsToRemove) => {
      const input: Record<string, unknown> = { ...validBase };
      for (const field of fieldsToRemove) {
        delete input[field];
      }
      expect(Schema.decodeUnknownEither(SearchParams)(input)._tag).toBe("Left");
    },
  );

  test.prop(
    [
      fc.constantFrom("origin", "destination", "departureDate"),
      fc.constantFrom("", "   ", null, undefined),
    ],
    { numRuns: 20 },
  )(
    "setting a required field to an empty/invalid value causes validation failure",
    (field, badValue) => {
      const input: Record<string, unknown> = { ...validBase };
      input[field] = badValue;
      expect(Schema.decodeUnknownEither(SearchParams)(input)._tag).toBe("Left");
    },
  );

  test.prop([fc.integer({ min: -10, max: 0 })], { numRuns: 20 })(
    "adults below 1 causes validation failure",
    (count) => {
      const input = {
        ...validBase,
        passengers: { adults: count, children: 0, infants: 0 },
      };
      expect(Schema.decodeUnknownEither(SearchParams)(input)._tag).toBe("Left");
    },
  );

  test.prop([fc.integer({ min: 10, max: 100 })], { numRuns: 20 })(
    "adults above 9 causes validation failure",
    (count) => {
      const input = {
        ...validBase,
        passengers: { adults: count, children: 0, infants: 0 },
      };
      expect(Schema.decodeUnknownEither(SearchParams)(input)._tag).toBe("Left");
    },
  );

  test("round-trip without returnDate causes validation failure", () => {
    const input = { ...validBase, tripType: "roundTrip" as const };
    delete input.returnDate;
    expect(Schema.decodeUnknownEither(SearchParams)(input)._tag).toBe("Left");
  });

  test("one-way without returnDate is valid", () => {
    const input = { ...validBase, tripType: "oneWay" as const };
    delete input.returnDate;
    expect(Schema.decodeUnknownEither(SearchParams)(input)._tag).toBe("Right");
  });
});
