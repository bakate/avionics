/**
 * Property-Based Tests for Passenger Schema validation
 * Feature: solo-passenger-age-validation
 *
 * Properties tested:
 * 1. Solo passenger under 18 on departure date must fail validation
 * 2. Solo passenger 18+ on departure date must pass validation
 * 3. Multiple passengers with any ages must pass validation (no age restriction)
 */

import { faker } from "@faker-js/faker";
import { fc, test } from "@fast-check/vitest";
import { EmailSchema } from "@workspace/domain/kernel";
import { Schema } from "effect";
import { describe, expect } from "vitest";
import {
  createPassengersSchema,
  PassengerInput,
} from "../../../machines/booking/schemas/passenger.schema.js";

// =============================================================================
// Arbitraries
// =============================================================================

const arbGender = fc.constantFrom("MALE" as const, "FEMALE" as const);

const arbEmail = fc
  .emailAddress()
  .map((e) => Schema.decodeSync(EmailSchema)(e));

const arbFirstName = fc.constantFrom(
  ...Array.from({ length: 20 }, () => faker.person.firstName()),
);

const arbLastName = fc.constantFrom(
  ...Array.from({ length: 20 }, () => faker.person.lastName()),
);

/**
 * Creates an arbitrary for a passenger with a specific age relative to a reference date
 * Returns passenger data with dateOfBirth as ISO string (as expected by the schema)
 * Note: Birth dates are calculated from current date to ensure they're in the past,
 * but age is calculated relative to the reference date (departure date)
 */
const arbPassengerWithAge = ({
  referenceDate,
  minAge,
  maxAge,
}: {
  referenceDate: Date;
  minAge: number;
  maxAge: number;
}) =>
  fc.record({
    firstName: arbFirstName,
    lastName: arbLastName,
    email: arbEmail,
    gender: arbGender,
    dateOfBirth: fc.integer({ min: minAge, max: maxAge }).map((age) => {
      // Calculate birth date from reference date (for age calculation)
      const birthDate = new Date(referenceDate);
      birthDate.setFullYear(birthDate.getFullYear() - age);

      // Ensure birth date is in the past relative to NOW (not reference date)
      const now = new Date();
      if (birthDate > now) {
        // If calculated birth date is in the future, use current date minus age
        const adjustedBirthDate = new Date(now);
        adjustedBirthDate.setFullYear(adjustedBirthDate.getFullYear() - age);
        adjustedBirthDate.setDate(adjustedBirthDate.getDate() - 1);
        return adjustedBirthDate.toISOString();
      }

      return birthDate.toISOString();
    }),
  });

/**
 * Creates an arbitrary for a passenger under 18 on the reference date
 */
const arbMinorPassenger = (referenceDate: Date) =>
  arbPassengerWithAge({
    referenceDate,
    minAge: 0,
    maxAge: 17,
  });

/**
 * Creates an arbitrary for a passenger 18+ on the reference date
 */
const arbAdultPassenger = (referenceDate: Date) =>
  arbPassengerWithAge({ referenceDate, minAge: 18, maxAge: 80 });

/**
 * Creates an arbitrary for any passenger (any age)
 */
const arbAnyPassenger = (referenceDate: Date) =>
  arbPassengerWithAge({ referenceDate, minAge: 0, maxAge: 80 });

// =============================================================================
// Property Tests
// =============================================================================

describe("Passenger Schema - Property-Based Tests", () => {
  // Use current date + 3 months as departure date (realistic future booking)
  const departureDate = new Date();
  departureDate.setMonth(departureDate.getMonth() + 3);
  const schema = createPassengersSchema(departureDate.toISOString());

  /**
   * Property 1: Solo passenger under 18 must fail validation
   */
  test.prop([arbMinorPassenger(departureDate)], { numRuns: 50 })(
    "Property 1: Solo passenger under 18 on departure date fails validation",
    (passenger) => {
      const data = { passengers: [passenger] };
      const result = Schema.decodeUnknownEither(schema)(data);

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(JSON.stringify(result.left)).toContain("solo_passenger_min_age");
      }
    },
  );

  /**
   * Property 2: Solo passenger 18+ must pass validation
   */
  test.prop([arbAdultPassenger(departureDate)], { numRuns: 50 })(
    "Property 2: Solo passenger 18+ on departure date passes validation",
    (passenger) => {
      const data = { passengers: [passenger] };
      const result = Schema.decodeUnknownEither(schema)(data);

      expect(result._tag).toBe("Right");
    },
  );

  /**
   * Property 3: Multiple passengers with any ages pass validation
   */
  test.prop(
    [fc.array(arbAnyPassenger(departureDate), { minLength: 2, maxLength: 9 })],
    { numRuns: 50 },
  )(
    "Property 3: Multiple passengers with any ages pass validation",
    (passengers) => {
      const data = { passengers };
      const result = Schema.decodeUnknownEither(schema)(data);

      expect(result._tag).toBe("Right");
    },
  );

  /**
   * Property 4: Edge case - passenger exactly 18 on departure date passes
   */
  test.prop([arbFirstName, arbLastName, arbEmail, arbGender], { numRuns: 20 })(
    "Property 4: Passenger exactly 18 years old on departure date passes validation",
    (firstName, lastName, email, gender) => {
      const birthDate = new Date(departureDate);
      birthDate.setFullYear(birthDate.getFullYear() - 18);

      const data = {
        passengers: [
          {
            firstName,
            lastName,
            email,
            gender,
            dateOfBirth: birthDate.toISOString(),
          },
        ],
      };

      const result = Schema.decodeUnknownEither(schema)(data);
      expect(result._tag).toBe("Right");
    },
  );

  /**
   * Property 5: Edge case - passenger 1 day before 18th birthday fails
   */
  test.prop([arbFirstName, arbLastName, arbEmail, arbGender], { numRuns: 20 })(
    "Property 5: Passenger 1 day before 18th birthday fails validation",
    (firstName, lastName, email, gender) => {
      const birthDate = new Date(departureDate);
      birthDate.setFullYear(birthDate.getFullYear() - 18);
      birthDate.setDate(birthDate.getDate() + 1); // 1 day after = still 17

      const data = {
        passengers: [
          {
            firstName,
            lastName,
            email,
            gender,
            dateOfBirth: birthDate.toISOString(),
          },
        ],
      };

      const result = Schema.decodeUnknownEither(schema)(data);
      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(JSON.stringify(result.left)).toContain("solo_passenger_min_age");
      }
    },
  );

  /**
   * Property 6: Round-trip encoding/decoding preserves passenger data
   */
  test.prop([arbAdultPassenger(departureDate)], { numRuns: 50 })(
    "Property 6: Encoding then decoding preserves passenger data",
    (passengerEncoded) => {
      // Decode from encoded format (ISO string) to Type (Date object)
      const decoded = Schema.decodeSync(PassengerInput)(passengerEncoded);

      // Re-encode back to encoded format
      const reEncoded = Schema.encodeSync(PassengerInput)(decoded);

      expect(reEncoded.firstName).toBe(passengerEncoded.firstName);
      expect(reEncoded.lastName).toBe(passengerEncoded.lastName);
      expect(reEncoded.email).toBe(passengerEncoded.email);
      expect(reEncoded.gender).toBe(passengerEncoded.gender);
      expect(reEncoded.dateOfBirth).toBe(passengerEncoded.dateOfBirth);
    },
  );
});
