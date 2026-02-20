/**
 * Feature: web-booking-app, Property 15: URL ↔ machine state synchronization
 * Validates: Requirements 9.3
 *
 * For any Booking_Machine state, the corresponding URL path should uniquely
 * identify that state, and navigating to that URL should restore the machine
 * to the equivalent state.
 */

import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  type BookingContext,
  type BookingResult,
  type BookingStateValue,
  initialContext,
  routeToState,
  stateToRoute,
} from "../booking.machine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeResult = (pnr: string): BookingResult => ({
  bookingId: "00000000-0000-0000-0000-000000000001",
  pnrCode: pnr,
  status: "Confirmed",
  totalPrice: { amount: 500, currency: "EUR" },
  confirmedAt: new Date().toISOString(),
});

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** States that have a deterministic route (no context dependency) */
const simpleStates: ReadonlyArray<[BookingStateValue, string]> = [
  ["idle", "/"],
  ["fetchingBookings", "/"],
  ["searching", "/"],
  ["selectingOutbound", "/outbound"],
  ["searchingReturn", "/return"],
  ["selectingReturn", "/return"],
  ["enteringPassengers", "/passengers"],
  ["paying", "/payment"],
];

const simpleStateArb = fc.constantFrom(...simpleStates);

const pnrArb = fc.stringMatching(/^[A-Z0-9]{6}$/);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 15: URL ↔ machine state synchronization", () => {
  test("simple states map to the expected route", () => {
    fc.assert(
      fc.property(simpleStateArb, ([state, expectedRoute]) => {
        const route = stateToRoute(state, initialContext);
        expect(route).toBe(expectedRoute);
      }),
      { numRuns: 100 },
    );
  });

  test("confirmed maps to /confirmation/:pnr", () => {
    fc.assert(
      fc.property(pnrArb, (pnr) => {
        const ctx: BookingContext = {
          ...initialContext,
          bookingResult: makeResult(pnr),
        };
        const route = stateToRoute("confirmed", ctx);
        expect(route).toBe(`/confirmation/${encodeURIComponent(pnr)}`);
      }),
      { numRuns: 100 },
    );
  });

  test("routeToState maps / to idle", () => {
    expect(routeToState("/")).toBe("idle");
  });

  test("routeToState maps /outbound to selectingOutbound", () => {
    expect(routeToState("/outbound")).toBe("selectingOutbound");
  });

  test("routeToState maps /return to selectingReturn", () => {
    expect(routeToState("/return")).toBe("selectingReturn");
  });

  test("routeToState maps /passengers to enteringPassengers", () => {
    expect(routeToState("/passengers")).toBe("enteringPassengers");
  });

  test("routeToState maps /payment to paying", () => {
    expect(routeToState("/payment")).toBe("paying");
  });

  test("routeToState maps /confirmation/:pnr to confirmed", () => {
    fc.assert(
      fc.property(pnrArb, (pnr) => {
        expect(routeToState(`/confirmation/${pnr}`)).toBe("confirmed");
      }),
      { numRuns: 100 },
    );
  });

  test("routeToState returns null for unknown paths", () => {
    expect(routeToState("/unknown")).toBeNull();
  });
});
