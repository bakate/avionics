/**
 * Property-Based Tests for BookFlightCommand schema validation
 * Feature: multi-passenger-pricing, Property 7: BookFlightCommand accepts valid multi-passenger commands
 */

import { fc } from "@fast-check/vitest";
import { EmailSchema } from "@workspace/domain/kernel";
import { Schema } from "effect";
import { describe, expect, test } from "vitest";
import { BookFlightCommand } from "../../../services/booking.service.js";

// =============================================================================
// Arbitraries
// =============================================================================

const arbGender = fc.constantFrom("MALE" as const, "FEMALE" as const);
const arbPassengerType = fc.constantFrom(
  "INFANT" as const,
  "CHILD" as const,
  "YOUNG_ADULT" as const,
  "ADULT" as const,
  "SENIOR" as const,
);
const arbCabinClass = fc.constantFrom(
  "ECONOMY" as const,
  "BUSINESS" as const,
  "FIRST" as const,
);

const arbEmail = fc
  .emailAddress()
  .map((e) => Schema.decodeSync(EmailSchema)(e));

const arbPassenger = fc.record({
  id: fc.uuid(),
  firstName: fc.string({ minLength: 1, maxLength: 50 }),
  lastName: fc.string({ minLength: 1, maxLength: 50 }),
  email: arbEmail,
  dateOfBirth: fc
    .integer({
      min: new Date("1980-01-01").getTime(),
      max: new Date("2027-12-31").getTime(),
    })
    .map((t) => new Date(t)),
  gender: arbGender,
  type: arbPassengerType,
});

type PassengerInput =
  typeof arbPassenger extends fc.Arbitrary<infer T> ? T : never;

const arbNonEmptyPassengers: fc.Arbitrary<
  [PassengerInput, ...Array<PassengerInput>]
> = fc
  .array(arbPassenger, { minLength: 1, maxLength: 9 })
  .filter(
    (arr): arr is [PassengerInput, ...Array<PassengerInput>] => arr.length > 0,
  );

// =============================================================================
// Property Tests
// =============================================================================

describe("BookFlightCommand - Property-Based Tests", () => {
  /**
   * Feature: multi-passenger-pricing, Property 7: BookFlightCommand schema accepts valid multi-passenger commands
   */
  test("Property 7: For any valid array of 1+ passengers, constructing BookFlightCommand succeeds; for empty array, it fails", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 9 }),
        arbCabinClass,
        arbNonEmptyPassengers,
        fc.webUrl(),
        (flightId, cabinClass, passengers, successUrl) => {
          // Valid multi-passenger command should construct successfully
          const cmd = new BookFlightCommand({
            segments: [
              {
                flightId,
                cabinClass,
              },
            ],
            passengers,
            successUrl,
          });

          expect(cmd.passengers.length).toBe(passengers.length);
          expect(cmd.segments[0].flightId).toBe(flightId);
          expect(cmd.segments[0].cabinClass).toBe(cabinClass);

          // Each passenger field should be preserved
          for (const [i, p] of passengers.entries()) {
            expect(cmd.passengers[i]?.id).toBe(p.id);
            expect(cmd.passengers[i]?.type).toBe(p.type);
          }

          // Empty passengers array should fail schema decoding
          expect(() =>
            Schema.decodeUnknownSync(BookFlightCommand)({
              segments: [
                {
                  flightId,
                  cabinClass,
                },
              ],
              passengers: [],
              successUrl,
            }),
          ).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });
});
