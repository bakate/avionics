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
import { SearchParams } from "@workspace/application/booking-types";
import { Schema } from "effect";
import { describe, expect } from "vitest";

const validRoundTrip = {
  tripType: "roundTrip" as const,
  origin: "CDG",
  destination: "JFK",
  departureDate: "2026-06-15",
  returnDate: "2026-06-22",
  passengers: { adults: 1, children: 0, infants: 0 },
};

const validOneWay = {
  tripType: "oneWay" as const,
  origin: "CDG",
  destination: "JFK",
  departureDate: "2026-06-15",
  passengers: { adults: 1, children: 0, infants: 0 },
};

const decode = Schema.decodeUnknownEither(SearchParams);

const requiredFieldSubset = fc.subarray(
  ["origin", "destination", "departureDate"] as const,
  { minLength: 1 },
);

describe("Property 2: Search form validation rejects missing required fields", () => {
  // --- Required field removal ---
  test.prop([requiredFieldSubset], { numRuns: 20 })(
    "removing any combination of required fields causes validation failure",
    (fieldsToRemove) => {
      const input: Record<string, unknown> = { ...validRoundTrip };
      for (const field of fieldsToRemove) {
        delete input[field];
      }
      expect(decode(input)._tag).toBe("Left");
    },
  );

  // --- Empty / invalid values for required fields ---
  test.prop(
    [
      fc.constantFrom("origin", "destination", "departureDate"),
      fc.constantFrom("", "   ", null, undefined),
    ],
    { numRuns: 20 },
  )(
    "setting a required field to an empty/invalid value causes validation failure",
    (field, badValue) => {
      const input: Record<string, unknown> = { ...validRoundTrip };
      input[field] = badValue;
      expect(decode(input)._tag).toBe("Left");
    },
  );

  // --- tripType validation ---
  test.prop(
    [
      fc.constantFrom("roundTrip", "oneWay") as fc.Arbitrary<
        "roundTrip" | "oneWay"
      >,
    ],
    { numRuns: 20 },
  )("valid tripType values are accepted with complete data", (tripType) => {
    const input =
      tripType === "roundTrip" ? { ...validRoundTrip } : { ...validOneWay };
    expect(decode(input)._tag).toBe("Right");
  });

  // --- Round-trip returnDate requirement ---
  test.prop([fc.constantFrom(undefined, "", "   ")], { numRuns: 20 })(
    "round-trip with missing or empty returnDate causes validation failure",
    (badReturn) => {
      const input: Record<string, unknown> = {
        ...validRoundTrip,
        returnDate: badReturn,
      };
      if (badReturn === undefined) {
        delete input.returnDate;
      }
      expect(decode(input)._tag).toBe("Left");
    },
  );

  test("one-way without returnDate is valid", () => {
    expect(decode(validOneWay)._tag).toBe("Right");
  });

  // --- Structured passengers: adults ---
  test.prop([fc.integer({ min: -10, max: 0 })], { numRuns: 20 })(
    "adults below 1 causes validation failure",
    (count) => {
      const input = {
        ...validRoundTrip,
        passengers: { adults: count, children: 0, infants: 0 },
      };
      expect(decode(input)._tag).toBe("Left");
    },
  );

  test.prop([fc.integer({ min: 10, max: 100 })], { numRuns: 20 })(
    "adults above 9 causes validation failure",
    (count) => {
      const input = {
        ...validRoundTrip,
        passengers: { adults: count, children: 0, infants: 0 },
      };
      expect(decode(input)._tag).toBe("Left");
    },
  );

  // --- Structured passengers: children ---
  test.prop([fc.integer({ min: -10, max: -1 })], { numRuns: 20 })(
    "children below 0 causes validation failure",
    (count) => {
      const input = {
        ...validRoundTrip,
        passengers: { adults: 1, children: count, infants: 0 },
      };
      expect(decode(input)._tag).toBe("Left");
    },
  );

  test.prop([fc.integer({ min: 9, max: 100 })], { numRuns: 20 })(
    "children above 8 causes validation failure",
    (count) => {
      const input = {
        ...validRoundTrip,
        passengers: { adults: 1, children: count, infants: 0 },
      };
      expect(decode(input)._tag).toBe("Left");
    },
  );

  // --- Structured passengers: infants ---
  test.prop([fc.integer({ min: -10, max: -1 })], { numRuns: 20 })(
    "infants below 0 causes validation failure",
    (count) => {
      const input = {
        ...validRoundTrip,
        passengers: { adults: 1, children: 0, infants: count },
      };
      expect(decode(input)._tag).toBe("Left");
    },
  );

  test.prop([fc.integer({ min: 5, max: 100 })], { numRuns: 20 })(
    "infants above 4 causes validation failure",
    (count) => {
      const input = {
        ...validRoundTrip,
        passengers: { adults: 1, children: 0, infants: count },
      };
      expect(decode(input)._tag).toBe("Left");
    },
  );

  // --- Valid structured passengers within bounds ---
  test.prop(
    [
      fc.integer({ min: 1, max: 9 }),
      fc.integer({ min: 0, max: 8 }),
      fc.integer({ min: 0, max: 4 }),
    ],
    { numRuns: 100 },
  )(
    "valid passenger counts within bounds are accepted",
    (adults, children, infants) => {
      const input = {
        ...validRoundTrip,
        passengers: { adults, children, infants },
      };
      expect(decode(input)._tag).toBe("Right");
    },
  );
});
