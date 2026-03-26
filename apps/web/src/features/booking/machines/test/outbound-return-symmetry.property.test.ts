/**
 * Feature: web-booking-app, Property 22: Outbound/return selection symmetry
 *
 * For any valid FlightSelection (flight + cabin + price), the selection should
 * be valid as both an outbound and a return selection. The FlightSelection type
 * is direction-agnostic, and the Booking_Machine should accept it in either
 * direction.
 */

import { type CabinClass, FlightId } from "@workspace/domain/kernel";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { createActor, fromPromise, waitFor } from "xstate";
import { type PassengerInput } from "../../schemas/passenger.schema";
import { type SearchParams } from "../../schemas/search.schema";
import {
  type BookingResponse,
  type BookingResult,
  type BookingSummary,
  bookingMachine,
  createFlightSelection,
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

/** Generate a FlightSelection from a FlightResult by picking one of its cabins */
const flightSelectionArb = flightResultArb.chain((flight) =>
  fc
    .integer({ min: 0, max: flight.cabins.length - 1 })
    .map((idx): FlightSelection => {
      const cabinData = (flight.cabins[idx] ?? flight.cabins[0])!;
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 22: Outbound/return selection symmetry", () => {
  test("any FlightSelection is accepted as outbound selection", async () => {
    await fc.assert(
      fc.asyncProperty(flightSelectionArb, async (selection) => {
        const machine = bookingMachine.provide({
          actors: {
            searchFlights: fromPromise(
              async () => [selection.flight] as Array<FlightResult>,
            ),
            searchReturnFlights: fromPromise(
              async () => [] as Array<FlightResult>,
            ),
            submitBooking: fromPromise<
              BookingResult,
              {
                segments: Array<{ flightId: string; cabinClass: CabinClass }>;
                passengers: ReadonlyArray<PassengerInput>;
              }
            >(async () => {
              throw new Error("Not implemented");
            }),
            fetchBookings: fromPromise<
              Array<BookingSummary>,
              { email?: string } | undefined
            >(async () => []),
            fetchBookingDetails: fromPromise<BookingResponse, { pnr: string }>(
              async () => ({}) as BookingResponse,
            ),
            confirmBooking: fromPromise<BookingResponse, { id: string }>(
              async () => ({}) as BookingResponse,
            ),
            cancelBooking: fromPromise<
              BookingResponse,
              { id: string; reason: string }
            >(async () => ({}) as BookingResponse),
          },
        });

        const actor = createActor(machine).start();
        actor.send({ type: "SEARCH", params: roundTripParams });
        await waitFor(actor, (s) => s.matches("selectingOutbound"));

        actor.send({ type: "SELECT_OUTBOUND", selection });

        const snap = actor.getSnapshot();
        // Should have transitioned past selectingOutbound
        expect(snap.value).not.toBe("selectingOutbound");
        expect(snap.context.selectedOutbound).toEqual(selection);
        expect(snap.context.selectedOutbound?.flight).toEqual(selection.flight);
        expect(snap.context.selectedOutbound?.cabin).toBe(selection.cabin);
        expect(snap.context.selectedOutbound?.price).toEqual(selection.price);
        actor.stop();
      }),
      { numRuns: 100 },
    );
  });

  test("any FlightSelection is accepted as return selection", async () => {
    await fc.assert(
      fc.asyncProperty(
        flightSelectionArb,
        flightSelectionArb,
        async (outboundSelection, returnSelection) => {
          const machine = bookingMachine.provide({
            actors: {
              searchFlights: fromPromise(
                async (): Promise<Array<FlightResult>> => [
                  outboundSelection.flight,
                ],
              ),
              searchReturnFlights: fromPromise(
                async (): Promise<Array<FlightResult>> => [
                  returnSelection.flight,
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

          actor.send({ type: "SELECT_OUTBOUND", selection: outboundSelection });
          await waitFor(actor, (s) => s.matches("selectingReturn"));

          actor.send({ type: "SELECT_RETURN", selection: returnSelection });

          const snap = actor.getSnapshot();
          expect(snap.value).toBe("enteringPassengers");
          expect(snap.context.selectedReturn).toEqual(returnSelection);
          expect(snap.context.selectedReturn?.flight).toEqual(
            returnSelection.flight,
          );
          expect(snap.context.selectedReturn?.cabin).toBe(
            returnSelection.cabin,
          );
          expect(snap.context.selectedReturn?.price).toEqual(
            returnSelection.price,
          );
          actor.stop();
        },
      ),
      { numRuns: 100 },
    );
  });

  test("FlightSelection type is direction-agnostic: same selection works in both directions", async () => {
    await fc.assert(
      fc.asyncProperty(flightSelectionArb, async (selection) => {
        // Use as outbound
        const machine1 = bookingMachine.provide({
          actors: {
            searchFlights: fromPromise(
              async (): Promise<Array<FlightResult>> => [selection.flight],
            ),
            searchReturnFlights: fromPromise(
              async (): Promise<Array<FlightResult>> => [selection.flight],
            ),
            submitBooking: fromPromise(async (): Promise<BookingResult> => {
              throw new Error("Not implemented");
            }),
          },
        });

        const actor1 = createActor(machine1).start();
        actor1.send({ type: "SEARCH", params: roundTripParams });
        await waitFor(actor1, (s) => s.matches("selectingOutbound"));
        actor1.send({ type: "SELECT_OUTBOUND", selection });
        await waitFor(actor1, (s) => s.matches("selectingReturn"));

        const outboundStored = actor1.getSnapshot().context.selectedOutbound;

        // Use same selection as return
        actor1.send({ type: "SELECT_RETURN", selection });
        const returnStored = actor1.getSnapshot().context.selectedReturn;

        // Both should store the exact same selection data
        expect(outboundStored).toEqual(selection);
        expect(returnStored).toEqual(selection);
        expect(outboundStored).toEqual(returnStored);
        actor1.stop();
      }),
      { numRuns: 100 },
    );
  });

  test("createFlightSelection produces direction-agnostic selections", () => {
    fc.assert(
      fc.property(flightResultArb, (flight) => {
        for (const cabinData of flight.cabins) {
          const selection = createFlightSelection(flight, cabinData.cabin);
          if (selection) {
            // The selection has no direction field — it's purely flight + cabin + price
            expect(selection).toEqual({
              flight,
              cabin: cabinData.cabin,
              price: cabinData.price,
            });
            // No "direction" property exists
            expect("direction" in selection).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
