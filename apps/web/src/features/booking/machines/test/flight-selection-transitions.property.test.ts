/**
 * Feature: web-booking-app, Property 23: Flight selection stores and transitions correctly
 *
 * For any valid FlightSelection and direction (outbound or return), the
 * Booking_Machine should store the selection in the correct context field
 * (selectedOutbound or selectedReturn) and transition to the next expected state.
 */

import { type BookingResponse } from "@workspace/api/booking-api";
import { type PassengerInput, type SearchParams } from "@workspace/application/booking-types";
import { type BookingSummary } from "@workspace/application/read-models";
import { type CabinClass, FlightId } from "@workspace/domain/kernel";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { createActor, fromPromise, waitFor } from "xstate";
import {
  type BookingResult,
  bookingMachine,
  FlightResult,
  type FlightSelection,
} from "../booking.machine";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const cabinClassArb = fc.constantFrom<CabinClass>(
  "ECONOMY",
  "BUSINESS",
  "FIRST",
);

const moneyArb = fc.record({
  amount: fc.integer({ min: 1, max: 99999 }),
  currency: fc.constantFrom("EUR", "USD", "GBP"),
});

const cabinArb = fc
  .tuple(cabinClassArb, moneyArb, fc.integer({ min: 1, max: 300 }))
  .map(([cabin, price, seats]) => ({
    cabin,
    availableSeats: seats,
    price,
  }));

const flightResultArb = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 10 }),
    fc.string({ minLength: 2, maxLength: 6 }),
    fc.constantFrom("CDG", "JFK", "LHR", "NRT"),
    fc.constantFrom("LAX", "ORD", "FRA", "SIN"),
    fc.integer({ min: 60, max: 900 }),
    fc.integer({ min: 0, max: 3 }),
    fc.uniqueArray(cabinArb, {
      minLength: 1,
      maxLength: 3,
      selector: (c) => c.cabin,
    }),
  )
  .map(
    ([id, flightNum, origin, dest, duration, stops, cabins]): FlightResult =>
      new FlightResult({
        flightId: FlightId.make(id),
        flightNumber: `AF${flightNum}`,
        origin,
        destination: dest,
        departureTime: new Date().toISOString(),
        arrivalTime: new Date().toISOString(),
        durationMinutes: duration,
        stops,
        cabins,
        lastUpdated: new Date().toISOString(),
      }),
  );

const flightSelectionArb = flightResultArb.chain((flight) =>
  fc
    .integer({ min: 0, max: flight.cabins.length - 1 })
    .map((idx): FlightSelection => {
      const cabinData = flight.cabins[idx] ?? flight.cabins[0];
      if (!cabinData) throw new Error("unreachable: cabins has minLength 1");
      return { flight, cabin: cabinData.cabin, price: cabinData.price };
    }),
);

const roundTripParams = {
  tripType: "roundTrip",
  origin: "CDG",
  destination: "JFK",
  departureDate: "2026-06-15",
  returnDate: "2026-06-22",
  passengers: { adults: 1, children: 0, infants: 0 },
} as unknown as SearchParams;

const oneWayParams = {
  tripType: "oneWay",
  origin: "CDG",
  destination: "JFK",
  departureDate: "2026-06-15",
  passengers: { adults: 1, children: 0, infants: 0 },
} as unknown as SearchParams;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 23: Flight selection stores and transitions correctly", () => {
  test("SELECT_OUTBOUND stores selection in selectedOutbound and transitions to searchingReturn (round-trip)", async () => {
    await fc.assert(
      fc.asyncProperty(flightSelectionArb, async (selection) => {
        const machine = bookingMachine.provide({
          actors: {
            searchFlights: fromPromise(
              async () => [selection.flight] as ReadonlyArray<FlightResult>,
            ),
            searchReturnFlights: fromPromise(
              async () => [] as ReadonlyArray<FlightResult>,
            ),
            submitBooking: fromPromise<
              BookingResult,
              {
                segments: ReadonlyArray<{
                  flightId: string;
                  cabinClass: CabinClass;
                }>;
                passengers: ReadonlyArray<PassengerInput>;
              }
            >(async () => {
              throw new Error("Not implemented");
            }),
            fetchBookings: fromPromise<
              ReadonlyArray<BookingSummary>,
              { email?: string } | undefined
            >(async () => []),
            fetchBookingDetails: fromPromise<unknown, { pnr: string }>(
              async () => ({}) as BookingResponse,
            ),
            confirmBooking: fromPromise<unknown, { id: string }>(
              async () => ({}) as BookingResponse,
            ),
            cancelBooking: fromPromise<unknown, { id: string; reason: string }>(
              async () => ({}) as BookingResponse,
            ),
          },
        });

        const actor = createActor(machine).start();
        actor.send({ type: "SEARCH", params: roundTripParams });
        await waitFor(actor, (s) => s.matches("selectingOutbound"));

        actor.send({ type: "SELECT_OUTBOUND", selection });

        // Should transition to searchingReturn (or selectingReturn after async)
        const snap = actor.getSnapshot();
        const validNextStates = ["searchingReturn", "selectingReturn"];
        expect(validNextStates).toContain(snap.value);
        expect(snap.context.selectedOutbound).toEqual(selection);
        expect(snap.context.selectedOutbound?.flight).toEqual(selection.flight);
        expect(snap.context.selectedOutbound?.cabin).toBe(selection.cabin);
        expect(snap.context.selectedOutbound?.price).toEqual(selection.price);
        // selectedReturn should still be null at this point
        expect(snap.context.selectedReturn).toBeNull();
        actor.stop();
      }),
      { numRuns: 100 },
    );
  });

  test("SELECT_OUTBOUND stores selection and transitions directly to enteringPassengers (one-way)", async () => {
    await fc.assert(
      fc.asyncProperty(flightSelectionArb, async (selection) => {
        const machine = bookingMachine.provide({
          actors: {
            searchFlights: fromPromise(
              async () => [selection.flight] as ReadonlyArray<FlightResult>,
            ),
            searchReturnFlights: fromPromise(
              async () => [] as ReadonlyArray<FlightResult>,
            ),
            submitBooking: fromPromise<
              BookingResult,
              {
                segments: ReadonlyArray<{
                  flightId: string;
                  cabinClass: CabinClass;
                }>;
                passengers: ReadonlyArray<PassengerInput>;
              }
            >(async () => {
              throw new Error("Not implemented");
            }),
            fetchBookings: fromPromise<
              ReadonlyArray<BookingSummary>,
              { email?: string } | undefined
            >(async () => []),
            fetchBookingDetails: fromPromise<unknown, { pnr: string }>(
              async () => ({}) as BookingResponse,
            ),
            confirmBooking: fromPromise<unknown, { id: string }>(
              async () => ({}) as BookingResponse,
            ),
            cancelBooking: fromPromise<unknown, { id: string; reason: string }>(
              async () => ({}) as BookingResponse,
            ),
          },
        });

        const actor = createActor(machine).start();
        actor.send({ type: "SEARCH", params: oneWayParams });
        await waitFor(actor, (s) => s.matches("selectingOutbound"));

        actor.send({ type: "SELECT_OUTBOUND", selection });

        const snap = actor.getSnapshot();
        expect(snap.value).toBe("enteringPassengers");
        expect(snap.context.selectedOutbound).toEqual(selection);
        // No return search should happen for one-way
        expect(snap.context.selectedReturn).toBeNull();
        expect(snap.context.returnFlights).toEqual([]);
        actor.stop();
      }),
      { numRuns: 100 },
    );
  });

  test("SELECT_RETURN stores selection in selectedReturn and transitions to enteringPassengers", async () => {
    await fc.assert(
      fc.asyncProperty(
        flightSelectionArb,
        flightSelectionArb,
        async (outbound, returnSel) => {
          const machine = bookingMachine.provide({
            actors: {
              searchFlights: fromPromise(
                async (): Promise<ReadonlyArray<FlightResult>> => [
                  outbound.flight,
                ],
              ),
              searchReturnFlights: fromPromise(
                async (): Promise<ReadonlyArray<FlightResult>> => [
                  returnSel.flight,
                ],
              ),
              submitBooking: fromPromise(async (): Promise<BookingResult> => {
                throw new Error("Not implemented");
              }),
            },
          });

          const actor = createActor(machine).start();
          actor.send({ type: "SEARCH", params: roundTripParams });
          await waitFor(actor, (s) => s.matches("selectingOutbound"));

          actor.send({ type: "SELECT_OUTBOUND", selection: outbound });
          await waitFor(actor, (s) => s.matches("selectingReturn"));

          actor.send({ type: "SELECT_RETURN", selection: returnSel });

          const snap = actor.getSnapshot();
          expect(snap.value).toBe("enteringPassengers");
          expect(snap.context.selectedReturn).toEqual(returnSel);
          expect(snap.context.selectedReturn?.flight).toEqual(returnSel.flight);
          expect(snap.context.selectedReturn?.cabin).toBe(returnSel.cabin);
          expect(snap.context.selectedReturn?.price).toEqual(returnSel.price);
          // Outbound should still be preserved
          expect(snap.context.selectedOutbound).toEqual(outbound);
          actor.stop();
        },
      ),
      { numRuns: 100 },
    );
  });

  test("outbound selection is stored in selectedOutbound, not selectedReturn (and vice versa)", async () => {
    await fc.assert(
      fc.asyncProperty(
        flightSelectionArb,
        flightSelectionArb,
        async (outbound, returnSel) => {
          const machine = bookingMachine.provide({
            actors: {
              searchFlights: fromPromise(
                async (): Promise<ReadonlyArray<FlightResult>> => [
                  outbound.flight,
                ],
              ),
              searchReturnFlights: fromPromise(
                async (): Promise<ReadonlyArray<FlightResult>> => [
                  returnSel.flight,
                ],
              ),
              submitBooking: fromPromise(async (): Promise<BookingResult> => {
                throw new Error("Not implemented");
              }),
            },
          });

          const actor = createActor(machine).start();
          actor.send({ type: "SEARCH", params: roundTripParams });
          await waitFor(actor, (s) => s.matches("selectingOutbound"));

          actor.send({ type: "SELECT_OUTBOUND", selection: outbound });
          await waitFor(actor, (s) => s.matches("selectingReturn"));

          // After outbound selection, verify correct field assignment
          const midSnap = actor.getSnapshot();
          expect(midSnap.context.selectedOutbound).toEqual(outbound);
          expect(midSnap.context.selectedReturn).toBeNull();

          actor.send({ type: "SELECT_RETURN", selection: returnSel });

          // After return selection, verify both fields are correctly assigned
          const finalSnap = actor.getSnapshot();
          expect(finalSnap.context.selectedOutbound).toEqual(outbound);
          expect(finalSnap.context.selectedReturn).toEqual(returnSel);
          // They should not be swapped
          expect(finalSnap.context.selectedOutbound).not.toEqual(returnSel);
          expect(finalSnap.context.selectedReturn).not.toEqual(outbound);
          actor.stop();
        },
      ),
      { numRuns: 100 },
    );
  });
});
