/**
 * Feature: web-booking-app, Property 14: Back navigation preserves context
 * Validates: Requirements 9.2
 *
 * For any Booking_Machine state beyond "idle", sending a BACK event should
 * transition to the previous state while preserving all previously entered
 * context data (search params, selected outbound, selected return, passengers).
 */

import { type BookingResponse } from "@workspace/api/booking-api";
import { type PassengerInput, type SearchParams } from "@workspace/application/booking-types";
import { type BookingSummary } from "@workspace/application/read-models";
import {
  type CabinClass,
  type Email,
  FlightId,
} from "@workspace/domain/kernel";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { createActor, fromPromise, waitFor } from "xstate";
import {
  type BookingResult,
  bookingMachine,
  FlightResult,
  type FlightSelection,
} from "../booking.machine";

const makeFlight = (id: string): FlightResult =>
  new FlightResult({
    flightId: FlightId.make(id),
    flightNumber: `AF${id}`,
    origin: "CDG",
    destination: "JFK",
    departureTime: new Date().toISOString(),
    arrivalTime: new Date().toISOString(),
    durationMinutes: 120,
    stops: 0,
    cabins: [
      {
        cabin: "ECONOMY" as CabinClass,
        availableSeats: 100,
        price: { amount: 200, currency: "EUR" },
      },
      {
        cabin: "BUSINESS" as CabinClass,
        availableSeats: 20,
        price: { amount: 800, currency: "EUR" },
      },
      {
        cabin: "FIRST" as CabinClass,
        availableSeats: 5,
        price: { amount: 2000, currency: "EUR" },
      },
    ],
    lastUpdated: new Date().toISOString(),
  });

const makeSelection = (
  flight: FlightResult,
  cabin: CabinClass = "ECONOMY",
): FlightSelection => {
  const cabinData = flight.cabins.find((c) => c.cabin === cabin);
  if (!cabinData) {
    throw new Error(`Cabin ${cabin} not found`);
  }
  return { flight, cabin, price: cabinData.price };
};

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

const flightIdArb = fc.string({ minLength: 1, maxLength: 10 });

describe("Property 14: Back navigation preserves context", () => {
  test("BACK from selectingOutbound preserves searchParams and outboundFlights", async () => {
    await fc.assert(
      fc.asyncProperty(flightIdArb, async (flightId) => {
        const flight = makeFlight(flightId);
        const machine = bookingMachine.provide({
          actors: {
            searchFlights: fromPromise(
              async () => [flight] as ReadonlyArray<FlightResult>,
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

        await waitFor(actor, (state) => state.matches("selectingOutbound"));

        actor.send({ type: "BACK" });
        const snap = actor.getSnapshot();
        expect(snap.value).toBe("idle");
        expect(snap.context.searchParams).toEqual(roundTripParams);
        expect(snap.context.outboundFlights).toEqual([flight]);
        actor.stop();
      }),
      { numRuns: 100 },
    );
  });

  test("BACK from selectingReturn preserves selectedOutbound", async () => {
    await fc.assert(
      fc.asyncProperty(flightIdArb, async (flightId) => {
        const flight = makeFlight(flightId);
        const returnFlight = makeFlight(`ret-${flightId}`);
        const selection = makeSelection(flight);

        const machine = bookingMachine.provide({
          actors: {
            searchFlights: fromPromise(
              async (): Promise<ReadonlyArray<FlightResult>> => [flight],
            ),
            searchReturnFlights: fromPromise(
              async (): Promise<ReadonlyArray<FlightResult>> => [returnFlight],
            ),
            submitBooking: fromPromise(async (): Promise<BookingResult> => {
              throw new Error("Not implemented");
            }),
          },
        });

        const actor = createActor(machine).start();
        actor.send({ type: "SEARCH", params: roundTripParams });
        await waitFor(actor, (state) => state.matches("selectingOutbound"));

        actor.send({ type: "SELECT_OUTBOUND", selection });
        await waitFor(actor, (state) => state.matches("selectingReturn"));

        actor.send({ type: "BACK" });
        const snap = actor.getSnapshot();
        expect(snap.value).toBe("selectingOutbound");
        expect(snap.context.selectedOutbound).toEqual(selection);
        expect(snap.context.selectedReturn).toBeNull();
        actor.stop();
      }),
      { numRuns: 100 },
    );
  });

  test("BACK from enteringPassengers (round-trip) goes to selectingReturn", async () => {
    await fc.assert(
      fc.asyncProperty(flightIdArb, async (flightId) => {
        const flight = makeFlight(flightId);
        const returnFlight = makeFlight(`ret-${flightId}`);
        const outSelection = makeSelection(flight);
        const retSelection = makeSelection(returnFlight);

        const machine = bookingMachine.provide({
          actors: {
            searchFlights: fromPromise(
              async (): Promise<ReadonlyArray<FlightResult>> => [flight],
            ),
            searchReturnFlights: fromPromise(
              async (): Promise<ReadonlyArray<FlightResult>> => [returnFlight],
            ),
            submitBooking: fromPromise(async (): Promise<BookingResult> => {
              throw new Error("Not implemented");
            }),
          },
        });

        const actor = createActor(machine).start();
        actor.send({ type: "SEARCH", params: roundTripParams });
        await waitFor(actor, (state) => state.matches("selectingOutbound"));

        actor.send({ type: "SELECT_OUTBOUND", selection: outSelection });
        await waitFor(actor, (state) => state.matches("selectingReturn"));

        actor.send({ type: "SELECT_RETURN", selection: retSelection });
        expect(actor.getSnapshot().value).toBe("enteringPassengers");

        actor.send({ type: "BACK" });
        const snap = actor.getSnapshot();
        expect(snap.value).toBe("selectingReturn");
        expect(snap.context.selectedOutbound).toEqual(outSelection);
        expect(snap.context.selectedReturn).toEqual(retSelection);
        actor.stop();
      }),
      { numRuns: 100 },
    );
  });

  test("BACK from enteringPassengers (one-way) goes to selectingOutbound", async () => {
    await fc.assert(
      fc.asyncProperty(flightIdArb, async (flightId) => {
        const flight = makeFlight(flightId);
        const selection = makeSelection(flight);

        const machine = bookingMachine.provide({
          actors: {
            searchFlights: fromPromise(
              async () => [flight] as ReadonlyArray<FlightResult>,
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
        await waitFor(actor, (state) => state.matches("selectingOutbound"));

        actor.send({ type: "SELECT_OUTBOUND", selection });
        expect(actor.getSnapshot().value).toBe("enteringPassengers");

        actor.send({ type: "BACK" });
        const snap = actor.getSnapshot();
        expect(snap.value).toBe("selectingOutbound");
        expect(snap.context.selectedOutbound).toEqual(selection);
        actor.stop();
      }),
      { numRuns: 100 },
    );
  });

  test("BACK from reviewingSummary preserves all previously entered context", async () => {
    await fc.assert(
      fc.asyncProperty(flightIdArb, async (flightId) => {
        const flight = makeFlight(flightId);
        const returnFlight = makeFlight(`ret-${flightId}`);
        const outSelection = makeSelection(flight);
        const retSelection = makeSelection(returnFlight);
        const passengers: ReadonlyArray<PassengerInput> = [
          {
            firstName: "Jean",
            lastName: "Dupont",
            email: "jean@example.com" as Email,
            dateOfBirth: new Date("1990-01-01"),
            gender: "MALE" as const,
          },
        ];

        const machine = bookingMachine.provide({
          actors: {
            searchFlights: fromPromise(
              async (): Promise<ReadonlyArray<FlightResult>> => [flight],
            ),
            searchReturnFlights: fromPromise(
              async (): Promise<ReadonlyArray<FlightResult>> => [returnFlight],
            ),
            submitBooking: fromPromise(async (): Promise<BookingResult> => {
              return new Promise<BookingResult>(() => {
                // Intentionally pending
              });
            }),
          },
        });

        const actor = createActor(machine).start();
        actor.send({ type: "SEARCH", params: roundTripParams });
        await waitFor(actor, (state) => state.matches("selectingOutbound"));

        actor.send({ type: "SELECT_OUTBOUND", selection: outSelection });
        await waitFor(actor, (state) => state.matches("selectingReturn"));

        actor.send({ type: "SELECT_RETURN", selection: retSelection });
        actor.send({ type: "SET_PASSENGERS", passengers });

        expect(actor.getSnapshot().value).toBe("reviewingSummary");

        actor.send({ type: "BACK" });
        const snap = actor.getSnapshot();
        expect(snap.value).toBe("enteringPassengers");
        expect(snap.context.searchParams).toEqual(roundTripParams);
        expect(snap.context.selectedOutbound).toEqual(outSelection);
        expect(snap.context.selectedReturn).toEqual(retSelection);
        expect(snap.context.passengers).toEqual(passengers);
        actor.stop();
      }),
      { numRuns: 100 },
    );
  });
});
