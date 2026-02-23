/**
 * Feature: web-booking-app, Property 13: Stepper reflects machine state
 * Validates: Requirements 9.1, 9.6
 *
 * For any state of the Booking_Machine, the stepper bar should highlight
 * the correct step corresponding to that state:
 *   idle/searching → 0 (Recherche)
 *   selectingOutbound/searchingReturn → 1 (Vol aller)
 *   selectingReturn → 2 (Vol retour)
 *   enteringPassengers → 3 (Passagers)
 *   paying → 4 (Paiement)
 *   confirmed → 5
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
  selectingOutbound: 1,
  searchingReturn: 1,
  selectingReturn: 2,
  enteringPassengers: 3,
  reviewingSummary: 4,
  paying: 4,
  redirecting: 4,
  confirmed: 5,
  error: -1,
};

const allStates: ReadonlyArray<BookingStateValue> = [
  "idle",
  "fetchingBookings",
  "searching",
  "selectingOutbound",
  "searchingReturn",
  "selectingReturn",
  "enteringPassengers",
  "paying",
  "confirmed",
  "error",
];

const stateArb = fc.constantFrom(...allStates);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 13: Stepper reflects machine state", () => {
  test("stateToStep maps every machine state to the correct step index", () => {
    fc.assert(
      fc.property(stateArb, (state) => {
        const step = stateToStep(state);
        expect(step).toBe(expectedMapping[state]);
      }),
      { numRuns: 100 },
    );
  });

  test("non-error states map to a valid STEP_LABELS index or confirmed (5)", () => {
    fc.assert(
      fc.property(stateArb, (state) => {
        const step = stateToStep(state);
        if (state === "error") {
          expect(step).toBe(-1);
        } else if (state === "confirmed") {
          expect(step).toBe(5);
        } else {
          expect(step).toBeGreaterThanOrEqual(0);
          expect(step).toBeLessThan(STEP_LABELS.length);
        }
      }),
      { numRuns: 100 },
    );
  });
});
