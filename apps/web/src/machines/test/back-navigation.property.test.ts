/**
 * Feature: web-booking-app, Property 13: Back navigation preserves context
 * Validates: Requirements 7.2
 *
 * For any Booking_Machine state beyond "idle", sending a BACK event should
 * transition to the previous state while preserving all previously entered
 * context data (search params, selected flight, passengers).
 */

import { type Route } from "@workspace/domain/kernel";
import { Option } from "effect";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { createActor, fromPromise, waitFor } from "xstate";
import { type PassengerInput } from "../../schemas/passenger.schema.js";
import { type SearchParams } from "../../schemas/search.schema.js";
import {
  type BookingResult,
  bookingMachine,
  type FlightResult,
} from "../booking.machine.js";

const makeFlight = (id: string): FlightResult => ({
  flightId: id,
  flightNumber: `AF${id}`,
  departureTime: new Date().toISOString(),
  arrivalTime: new Date().toISOString(),
  durationMinutes: 120,
  stops: 0,
  economyAvailable: 100,
  businessAvailable: 20,
  firstAvailable: 5,
  economyPrice: { amount: 200, currency: "EUR" },
  businessPrice: { amount: 800, currency: "EUR" },
  firstPrice: { amount: 2000, currency: "EUR" },
  lastUpdated: new Date().toISOString(),
});

const searchParams: SearchParams = {
  origin: "CDG" as Route["origin"],
  destination: "JFK" as Route["destination"],
  departureDate: new Date("2026-06-15"),
  returnDate: Option.none(),
  passengerCount: 2,
  cabinClass: Option.none(),
};

const flightIdArb = fc.string({ minLength: 1, maxLength: 10 });

describe("Property 13: Back navigation preserves context", () => {
  test("BACK from selectingFlight preserves searchParams and flights", async () => {
    await fc.assert(
      fc.asyncProperty(flightIdArb, async (flightId) => {
        const flight = makeFlight(flightId);
        const machine = bookingMachine.provide({
          actors: {
            searchFlights: fromPromise(async () => [flight]),
            submitBooking: fromPromise(async (): Promise<BookingResult> => {
              throw new Error("Not implemented");
            }),
          },
        });

        const actor = createActor(machine).start();
        actor.send({ type: "SEARCH", params: searchParams });

        await waitFor(actor, (state) => state.matches("selectingFlight"));

        actor.send({ type: "BACK" });
        const snap = actor.getSnapshot();
        expect(snap.value).toBe("idle");
        expect(snap.context.searchParams).toEqual(searchParams);
        expect(snap.context.flights).toEqual([flight]);
        actor.stop();
      }),
      { numRuns: 100 },
    );
  });

  test("BACK from selectingCabin preserves searchParams and flights", async () => {
    await fc.assert(
      fc.asyncProperty(flightIdArb, async (flightId) => {
        const flight = makeFlight(flightId);
        const machine = bookingMachine.provide({
          actors: {
            searchFlights: fromPromise(async () => [flight]),
            submitBooking: fromPromise(async (): Promise<BookingResult> => {
              throw new Error("Not implemented");
            }),
          },
        });

        const actor = createActor(machine).start();
        actor.send({ type: "SEARCH", params: searchParams });
        await waitFor(actor, (state) => state.matches("selectingFlight"));

        actor.send({ type: "SELECT_FLIGHT", flight });
        expect(actor.getSnapshot().value).toBe("selectingCabin");

        actor.send({ type: "BACK" });
        const snap = actor.getSnapshot();
        expect(snap.value).toBe("selectingFlight");
        expect(snap.context.searchParams).toEqual(searchParams);
        expect(snap.context.flights).toEqual([flight]);
        expect(snap.context.selectedCabin).toBeNull();
        actor.stop();
      }),
      { numRuns: 100 },
    );
  });

  test("BACK from enteringPassengers preserves selectedFlight", async () => {
    await fc.assert(
      fc.asyncProperty(flightIdArb, async (flightId) => {
        const flight = makeFlight(flightId);
        const machine = bookingMachine.provide({
          actors: {
            searchFlights: fromPromise(async () => [flight]),
            submitBooking: fromPromise(async (): Promise<BookingResult> => {
              throw new Error("Not implemented");
            }),
          },
        });

        const actor = createActor(machine).start();
        actor.send({ type: "SEARCH", params: searchParams });
        await waitFor(actor, (state) => state.matches("selectingFlight"));

        actor.send({ type: "SELECT_FLIGHT", flight });
        actor.send({ type: "SELECT_CABIN", cabin: "ECONOMY" });
        expect(actor.getSnapshot().value).toBe("enteringPassengers");

        actor.send({ type: "BACK" });
        const snap = actor.getSnapshot();
        expect(snap.value).toBe("selectingCabin");
        expect(snap.context.searchParams).toEqual(searchParams);
        expect(snap.context.selectedFlight).toEqual(flight);
        actor.stop();
      }),
      { numRuns: 100 },
    );
  });

  test("BACK from paying preserves all previously entered context", async () => {
    await fc.assert(
      fc.asyncProperty(flightIdArb, async (flightId) => {
        const flight = makeFlight(flightId);
        const passenger: PassengerInput = {
          firstName: "Jean",
          lastName: "Dupont",
          email: "jean@example.com" as any,
          dateOfBirth: new Date("1990-01-01"),
          gender: "MALE" as const,
        };

        const machine = bookingMachine.provide({
          actors: {
            searchFlights: fromPromise(async () => [flight]),
            submitBooking: fromPromise(async (): Promise<BookingResult> => {
              return new Promise<BookingResult>(() => {
                // Intentionally pending
              });
            }),
          },
        });

        const actor = createActor(machine).start();
        actor.send({ type: "SEARCH", params: searchParams });
        await waitFor(actor, (state) => state.matches("selectingFlight"));

        actor.send({ type: "SELECT_FLIGHT", flight });
        actor.send({ type: "SELECT_CABIN", cabin: "BUSINESS" });
        actor.send({ type: "SET_PASSENGER", passenger });

        // Should be in paying state
        expect(actor.getSnapshot().value).toBe("paying");

        actor.send({ type: "BACK" });
        const snap = actor.getSnapshot();
        expect(snap.value).toBe("enteringPassengers");
        expect(snap.context.searchParams).toEqual(searchParams);
        expect(snap.context.selectedFlight).toEqual(flight);
        expect(snap.context.selectedCabin).toBe("BUSINESS");
        expect(snap.context.passenger).toEqual(passenger);
        actor.stop();
      }),
      { numRuns: 100 },
    );
  });
});
