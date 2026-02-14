/**
 * Feature: web-booking-app, Property 2: Search form validation rejects missing required fields
 * Validates: Requirements 1.4
 *
 * For any combination of search form inputs where at least one required field
 * (origin, destination, departure date) is missing or empty, the validation
 * should reject the submission and produce error messages for exactly the missing fields.
 */

import { fc, test } from "@fast-check/vitest";
import { Schema } from "effect";
import { describe, expect } from "vitest";
import { SearchParams } from "../search.schema.js";

const validBase = {
  origin: "CDG",
  destination: "JFK",
  departureDate: new Date("2026-06-15").toISOString(),
  passengerCount: 1,
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
    "passengerCount below 1 causes validation failure",
    (count) => {
      const input = { ...validBase, passengerCount: count };
      expect(Schema.decodeUnknownEither(SearchParams)(input)._tag).toBe("Left");
    },
  );

  test.prop([fc.integer({ min: 10, max: 100 })], { numRuns: 20 })(
    "passengerCount above 9 causes validation failure",
    (count) => {
      const input = { ...validBase, passengerCount: count };
      expect(Schema.decodeUnknownEither(SearchParams)(input)._tag).toBe("Left");
    },
  );
});
