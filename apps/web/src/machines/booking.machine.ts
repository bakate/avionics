/**
 * Booking Machine — xstate v5 state machine orchestrating the entire booking flow.
 *
 * States: idle → searching → selectingFlight → selectingCabin → enteringPassengers → paying → confirmed | error
 *
 * Requirements: 9.1, 9.5
 */

import { type BookFlightCommand } from "@workspace/application/booking.commands";
import { type BookingSummary } from "@workspace/application/read-models";
import {
  type CabinClass,
  Money,
  type PassengerType,
} from "@workspace/domain/kernel";
import { type Passenger } from "@workspace/domain/passenger";
import { Effect } from "effect";
import { v4 as uuidv4 } from "uuid";
import { assign, fromPromise, setup } from "xstate";
import { bookFlight, getBookings } from "../api/booking.api";
import { runPromise } from "../api/client";
import { findAvailableFlights } from "../api/inventory.api";
import { type PassengerInput } from "../schemas/passenger.schema";
import { type SearchParams } from "../schemas/search.schema";

const derivePassengerType = (dateOfBirth: Date): PassengerType => {
  const age = new Date().getFullYear() - dateOfBirth.getFullYear();
  if (age < 2) return "INFANT";
  if (age < 12) return "CHILD";
  if (age < 18) return "YOUNG_ADULT";
  if (age < 65) return "ADULT";
  return "SENIOR";
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * Lightweight flight representation stored in machine context.
 * Mirrors the FlightAvailability read model shape.
 */
export type FlightResult = {
  readonly flightId: string;
  readonly economyAvailable: number;
  readonly businessAvailable: number;
  readonly firstAvailable: number;
  readonly economyPrice: { readonly amount: number; readonly currency: string };
  readonly businessPrice: {
    readonly amount: number;
    readonly currency: string;
  };
  readonly firstPrice: { readonly amount: number; readonly currency: string };
  readonly lastUpdated: string;
};

export type BookingResult = {
  readonly bookingId: string;
  readonly pnrCode: string;
  readonly status: string;
  readonly totalPrice: { readonly amount: number; readonly currency: string };
  readonly confirmedAt: string;
};

export type BookingContext = {
  searchParams: SearchParams | null;
  flights: ReadonlyArray<FlightResult>;
  allBookings: ReadonlyArray<BookingSummary>;
  selectedFlight: FlightResult | null;
  selectedCabin: CabinClass | null;
  passengers: ReadonlyArray<PassengerInput>;
  bookingResult: BookingResult | null;
  error: string | null;
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type BookingEvent =
  | { type: "SEARCH"; params: SearchParams }
  | { type: "FETCH_BOOKINGS" }
  | { type: "SELECT_FLIGHT"; flight: FlightResult }
  | { type: "SELECT_CABIN"; cabin: CabinClass }
  | { type: "SET_PASSENGERS"; passengers: ReadonlyArray<PassengerInput> }
  | { type: "ERROR"; message: string }
  | { type: "RETRY" }
  | { type: "BACK" }
  | { type: "RESET" };

// ---------------------------------------------------------------------------
// Initial context
// ---------------------------------------------------------------------------

export const initialContext: BookingContext = {
  searchParams: null,
  flights: [],
  allBookings: [],
  selectedFlight: null,
  selectedCabin: null,
  passengers: [],
  bookingResult: null,
  error: null,
};

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

const hasPassengers = ({ context }: { context: BookingContext }) =>
  context.passengers.length > 0;

const hasSelectedFlight = ({ context }: { context: BookingContext }) =>
  context.selectedFlight !== null;

const hasSelectedCabin = ({ context }: { context: BookingContext }) =>
  context.selectedCabin !== null;

// ---------------------------------------------------------------------------
// Machine
// ---------------------------------------------------------------------------

export const bookingMachine = setup({
  types: {
    context: {} as BookingContext,
    events: {} as BookingEvent,
  },
  actors: {
    searchFlights: fromPromise(
      async ({
        input,
      }: {
        input: SearchParams;
      }): Promise<Array<FlightResult>> => {
        const effect = findAvailableFlights({
          cabin: "ECONOMY", // Default or derived from params if needed
          origin: input.origin,
          destination: input.destination,
          departureDate: input.departureDate,
        });
        const flights = await runPromise(effect);
        // Map the API response (FlightAvailability) to the machine's FlightResult
        return flights.map((f) => ({
          ...f,
          lastUpdated: f.lastUpdated.toISOString(),
        }));
      },
    ),
    fetchBookings: fromPromise(
      async (): Promise<ReadonlyArray<BookingSummary>> => {
        try {
          const effect = getBookings();
          const bookings = await runPromise(effect);
          console.log("Fetched bookings:", bookings);
          return bookings.map((b) => ({
            id: b.id,
            pnrCode: b.pnrCode,
            status: b.status,
            passengerCount: b.passengers.length,
            totalPrice: b.segments.reduce(
              (sum, seg: any) => {
                // Ensure we have a Money instance for the accumulator
                const acc =
                  sum instanceof Money
                    ? sum
                    : Money.of((sum as any).amount, (sum as any).currency);
                // Ensure we have a Money instance for the segment price
                const price =
                  seg.price instanceof Money
                    ? seg.price
                    : Money.of(seg.price.amount, seg.price.currency);
                return acc.add(price);
              },
              Money.zero(b.segments[0]?.price.currency ?? "EUR"),
            ),
            createdAt: b.createdAt,
            expiresAt: b.expiresAt,
          }));
        } catch (error) {
          console.error("Failed to fetch bookings:", error);
          throw error;
        }
      },
    ),
    submitBooking: fromPromise(
      async ({
        input,
      }: {
        input: {
          flightId: string;
          cabinClass: CabinClass;
          passengers: ReadonlyArray<PassengerInput>;
        };
      }): Promise<BookingResult> => {
        if (input.passengers.length === 0) {
          throw new Error("No passengers provided");
        }

        const command: BookFlightCommand = {
          flightId: input.flightId,
          cabinClass: input.cabinClass,
          passengers: input.passengers.map((p) => ({
            id: uuidv4(),
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email,
            dateOfBirth: p.dateOfBirth,
            gender: p.gender,
            type: derivePassengerType(p.dateOfBirth),
          })) as [Passenger, ...Array<Passenger>], // NonEmptyArray cast
          successUrl: `${window.location.origin}/success`,
          cancelUrl: `${window.location.origin}/cancel`,
        };

        const effect = bookFlight(command);
        const response = await runPromise(Effect.scoped(effect));

        // Calculate total price from segments
        const totalPrice = response.booking.segments.reduce(
          (sum, seg) => sum.add(seg.price),
          Money.zero(response.booking.segments[0]?.price.currency ?? "EUR"),
        );

        return {
          bookingId: response.booking.id,
          pnrCode: response.booking.pnrCode,
          status: response.booking.status,
          totalPrice: {
            amount: totalPrice.amount,
            currency: totalPrice.currency,
          },
          confirmedAt: response.booking.createdAt.toISOString(),
        };
      },
    ),
  },
  guards: {
    hasPassengers,
    hasSelectedFlight,
    hasSelectedCabin,
  },
}).createMachine({
  id: "booking",
  initial: "idle",
  context: initialContext,

  states: {
    idle: {
      on: {
        SEARCH: {
          target: "searching",
          actions: assign({
            searchParams: ({ event }) => event.params,
            flights: () => [],
            selectedFlight: () => null,
            selectedCabin: () => null,
            passengers: () => [],
            bookingResult: () => null,
            error: () => null,
          }),
        },
        FETCH_BOOKINGS: {
          target: "fetchingBookings",
        },
      },
    },

    fetchingBookings: {
      tags: ["loading"],
      entry: () => console.log("Entering fetchingBookings state..."),
      invoke: {
        src: "fetchBookings",
        onDone: {
          target: "idle",
          actions: assign({
            allBookings: ({ event }) => event.output,
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to fetch bookings",
          }),
        },
      },
    },

    searching: {
      tags: ["loading"],
      invoke: {
        src: "searchFlights",
        input: ({ context }) => context.searchParams as SearchParams,
        onDone: {
          target: "selectingFlight",
          actions: assign({
            flights: ({ event }) => event.output,
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Search failed",
          }),
        },
      },
      on: {
        RESET: { target: "idle", actions: assign(initialContext) },
      },
    },

    selectingFlight: {
      on: {
        SELECT_FLIGHT: {
          target: "selectingCabin",
          actions: assign({
            selectedFlight: ({ event }) => event.flight,
            selectedCabin: () => null,
          }),
        },
        SEARCH: {
          target: "searching",
          actions: assign({
            searchParams: ({ event }) => event.params,
            flights: () => [],
            selectedFlight: () => null,
            selectedCabin: () => null,
            passengers: () => [],
            bookingResult: () => null,
            error: () => null,
          }),
        },
        BACK: { target: "idle" },
        ERROR: {
          target: "error",
          actions: assign({ error: ({ event }) => event.message }),
        },
        RESET: { target: "idle", actions: assign(initialContext) },
      },
    },

    selectingCabin: {
      on: {
        SELECT_CABIN: {
          target: "enteringPassengers",
          actions: assign({
            selectedCabin: ({ event }) => event.cabin,
          }),
        },
        BACK: {
          target: "selectingFlight",
          actions: assign({ selectedCabin: () => null }),
        },
        ERROR: {
          target: "error",
          actions: assign({ error: ({ event }) => event.message }),
        },
        RESET: { target: "idle", actions: assign(initialContext) },
      },
    },

    enteringPassengers: {
      on: {
        SET_PASSENGERS: {
          target: "paying",
          guard: "hasSelectedCabin",
          actions: assign({
            passengers: ({ event }) => event.passengers,
          }),
        },
        BACK: {
          target: "selectingCabin",
          actions: assign({ passengers: () => [] }),
        },
        ERROR: {
          target: "error",
          actions: assign({ error: ({ event }) => event.message }),
        },
        RESET: { target: "idle", actions: assign(initialContext) },
      },
    },

    paying: {
      tags: ["loading"],
      invoke: {
        src: "submitBooking",
        input: ({ context }) => ({
          flightId: context.selectedFlight?.flightId ?? "",
          cabinClass: context.selectedCabin ?? "ECONOMY",
          passengers: context.passengers,
        }),
        onDone: {
          target: "confirmed",
          actions: assign({
            bookingResult: ({ event }) => event.output,
            error: () => null,
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Booking failed",
          }),
        },
      },
      on: {
        BACK: {
          target: "enteringPassengers",
        },
        RESET: { target: "idle", actions: assign(initialContext) },
      },
    },

    confirmed: {
      on: {
        RESET: { target: "idle", actions: assign(initialContext) },
      },
    },

    error: {
      on: {
        RETRY: { target: "idle" },
        FETCH_BOOKINGS: { target: "fetchingBookings" },
        RESET: { target: "idle", actions: assign(initialContext) },
      },
    },
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All possible machine state values */
export type BookingStateValue =
  | "idle"
  | "fetchingBookings"
  | "searching"
  | "selectingFlight"
  | "selectingCabin"
  | "enteringPassengers"
  | "paying"
  | "confirmed"
  | "error";

/** Map machine state to booking flow step index (0-based) */
export const stateToStep = (state: BookingStateValue): number => {
  const mapping: Record<BookingStateValue, number> = {
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
  return mapping[state];
};

/** Step labels for the step indicator */
export const STEP_LABELS = [
  "Search",
  "Select",
  "Passengers",
  "Payment",
  "Confirmation",
] as const;

export type StepLabel = (typeof STEP_LABELS)[number];

/** Map machine state to the corresponding route path */
export const stateToRoute = (
  state: BookingStateValue,
  context: BookingContext,
): string => {
  switch (state) {
    case "idle":
    case "fetchingBookings":
    case "searching":
      return "/";
    case "selectingFlight":
      return "/results";
    case "selectingCabin":
      return context.selectedFlight
        ? `/select/${encodeURIComponent(context.selectedFlight.flightId)}`
        : "/results";
    case "enteringPassengers":
      return "/passengers";
    case "paying":
      return "/payment";
    case "confirmed":
      return context.bookingResult
        ? `/confirmation/${encodeURIComponent(context.bookingResult.pnrCode)}`
        : "/";
    case "error":
      return "/";
  }
};

/** Map a route path to the expected machine state */
export const routeToState = (path: string): BookingStateValue | null => {
  if (path === "/") return "idle";
  if (path === "/results") return "selectingFlight";
  if (path.startsWith("/select/")) return "selectingCabin";
  if (path === "/passengers") return "enteringPassengers";
  if (path === "/payment") return "paying";
  if (path.startsWith("/confirmation/")) return "confirmed";
  return null;
};
