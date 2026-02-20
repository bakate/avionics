/**
 * Feature: web-booking-app, Property 12: Step indicator matches machine state
 * Validates: Requirements 7.1
 *
 * For any state of the Booking_Machine, the step indicator should highlight
 * the correct step corresponding to that state:
 *   idle/searching → Search (0)
 *   selectingFlight/selectingCabin → Select (1)
 *   enteringPassengers → Passengers (2)
 *   paying → Payment (3)
 *   confirmed → Confirmation (4)
 *   error → -1
 */

import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  type BookingStateValue,
  STEP_LABELS,
  stateToStep,
} from "../booking.machine";

// ---------------------------------------------------------------------------
// Expected mapping (ground truth from the design)
// ---------------------------------------------------------------------------

const expectedMapping: Record<BookingStateValue, number> = {
  idle: 0,
  fetchingBookings: 0,
  searching: 0,
  selectingFlight: 1,
  selectingCabin: 1,
  enteringPassengers: 2,
  paying: 3,
  confirmed: 4,
  error: -1,
};

const allStates: ReadonlyArray<BookingStateValue> = [
  "idle",
  "fetchingBookings",
  "searching",
  "selectingFlight",
  "selectingCabin",
  "enteringPassengers",
  "paying",
  "confirmed",
  "error",
];

const stateArb = fc.constantFrom(...allStates);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 12: Step indicator matches machine state", () => {
  test("stateToStep maps every machine state to the correct step index", () => {
    fc.assert(
      fc.property(stateArb, (state) => {
        const step = stateToStep(state);
        expect(step).toBe(expectedMapping[state]);
      }),
      { numRuns: 100 },
    );
  });

  test("non-error states map to a valid STEP_LABELS index", () => {
    fc.assert(
      fc.property(stateArb, (state) => {
        const step = stateToStep(state);
        if (state !== "error") {
          expect(step).toBeGreaterThanOrEqual(0);
          expect(step).toBeLessThan(STEP_LABELS.length);
        } else {
          expect(step).toBe(-1);
        }
      }),
      { numRuns: 100 },
    );
  });
});
