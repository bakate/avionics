/**
 * Feature: web-booking-app, Property 9: Passenger validation rejects invalid input
 * Validates: Requirements 4.2
 *
 * For any PassengerInput where at least one field is invalid (empty name,
 * malformed email, future date of birth), Effect Schema validation should
 * reject it and produce a non-empty array of error messages.
 */

import { fc, test } from "@fast-check/vitest";
import { Schema } from "effect";
import { describe, expect } from "vitest";
import { PassengerInput } from "../passenger.schema.js";

const validBase = {
  firstName: "Jean",
  lastName: "Dupont",
  email: "jean@example.com",
  dateOfBirth: "1990-01-15T00:00:00.000Z",
  gender: "MALE" as const,
};

describe("Property 9: Passenger validation rejects invalid input", () => {
  test.prop(
    [fc.constantFrom("firstName", "lastName"), fc.constantFrom("", "   ")],
    { numRuns: 10 },
  )(
    "empty or whitespace-only name fields cause validation failure",
    (field, badValue) => {
      const input = { ...validBase, [field]: badValue };
      expect(Schema.decodeUnknownEither(PassengerInput)(input)._tag).toBe(
        "Left",
      );
    },
  );

  test.prop(
    [fc.constantFrom("notanemail", "foo@", "@bar.com", "a b@c.com", "")],
    { numRuns: 10 },
  )("malformed email causes validation failure", (badEmail) => {
    const input = { ...validBase, email: badEmail };
    expect(Schema.decodeUnknownEither(PassengerInput)(input)._tag).toBe("Left");
  });

  test.prop([fc.integer({ min: 1, max: 3650 })], { numRuns: 10 })(
    "future date of birth causes validation failure",
    (daysInFuture) => {
      const future = new Date();
      future.setDate(future.getDate() + daysInFuture);
      const input = { ...validBase, dateOfBirth: future.toISOString() };
      expect(Schema.decodeUnknownEither(PassengerInput)(input)._tag).toBe(
        "Left",
      );
    },
  );

  test.prop([fc.constantFrom("OTHER", "X", "", "male", "female")], {
    numRuns: 10,
  })("invalid gender value causes validation failure", (badGender) => {
    const input = { ...validBase, gender: badGender };
    expect(Schema.decodeUnknownEither(PassengerInput)(input)._tag).toBe("Left");
  });
});
