/**
 * Booking Machine — xstate v5 state machine orchestrating the Air France-style booking flow.
 *
 * States: idle → searching → selectingOutbound → searchingReturn → selectingReturn
 *   → enteringPassengers → paying → confirmed | error
 *
 */

import { type BookingResponse } from "@workspace/api/booking-api";
import { type BookFlightCommand } from "@workspace/application/booking.commands";
import { type BookingSummary } from "@workspace/application/read-models";
import {
  type CabinClass,
  CabinClassSchema,
  type CurrencyCode,
  Money,
  type PassengerType,
} from "@workspace/domain/kernel";
import { type BookingSegment } from "@workspace/domain/segment";
import { Effect, Schema } from "effect";
import { v4 as uuidv4 } from "uuid";
import { assign, fromPromise, setup } from "xstate";
import { bookFlight, getBookings } from "@/api/booking.api";
import { findAvailableFlights } from "@/api/inventory.api";
import { type PassengerInput } from "../schemas/passenger.schema";
import { type SearchParams } from "../schemas/search.schema";
import { loadLastEmail, saveLastEmail } from "./booking.persistence";

const derivePassengerType = (dateOfBirth: Date): PassengerType => {
  const age = new Date().getFullYear() - dateOfBirth.getFullYear();
  if (age < 2) return "INFANT";
  if (age < 12) return "CHILD";
  if (age < 18) return "YOUNG_ADULT";
  if (age < 65) return "ADULT";
  return "SENIOR";
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Lightweight flight representation stored in machine context.
 * Mirrors the FlightAvailability read model shape.
 */
export class FlightResult extends Schema.Class<FlightResult>("FlightResult")({
  flightId: Schema.String,
  flightNumber: Schema.String,
  origin: Schema.String,
  destination: Schema.String,
  departureTime: Schema.String,
  arrivalTime: Schema.String,
  durationMinutes: Schema.Number,
  stops: Schema.Number,
  aircraft: Schema.optional(Schema.String),
  cabins: Schema.Array(
    Schema.Struct({
      cabin: CabinClassSchema,
      availableSeats: Schema.Number,
      price: Schema.Struct({ amount: Schema.Number, currency: Schema.String }),
    }),
  ),
  lastUpdated: Schema.String,
}) {}

/** A user's flight + cabin selection */
export class FlightSelection extends Schema.Class<FlightSelection>(
  "FlightSelection",
)({
  flight: FlightResult,
  cabin: CabinClassSchema,
  price: Schema.Struct({ amount: Schema.Number, currency: Schema.String }),
}) {}

export class BookingResult extends Schema.Class<BookingResult>("BookingResult")(
  {
    bookingId: Schema.String,
    pnrCode: Schema.String,
    status: Schema.String,
    totalPrice: Schema.Struct({
      amount: Schema.Number,
      currency: Schema.String,
    }),
    confirmedAt: Schema.String,
    checkoutUrl: Schema.optional(Schema.String),
  },
) {}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export type BookingContext = {
  searchParams: SearchParams | null;
  outboundFlights: ReadonlyArray<FlightResult>;
  returnFlights: ReadonlyArray<FlightResult>;
  selectedOutbound: FlightSelection | null;
  selectedReturn: FlightSelection | null;
  passengers: ReadonlyArray<PassengerInput>;
  bookingResult: BookingResult | null;
  allBookings: ReadonlyArray<BookingSummary>;
  userEmail: string | null;
  error: string | null;
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type BookingEvent =
  | { type: "SEARCH"; params: SearchParams }
  | { type: "FETCH_BOOKINGS" }
  | { type: "SELECT_OUTBOUND"; selection: FlightSelection }
  | { type: "SELECT_RETURN"; selection: FlightSelection }
  | { type: "SET_PASSENGERS"; passengers: ReadonlyArray<PassengerInput> }
  | { type: "CONFIRM_PAYMENT" }
  | { type: "CHANGE_OUTBOUND_DATE"; date: string }
  | { type: "CHANGE_RETURN_DATE"; date: string }
  | { type: "ERROR"; message: string }
  | { type: "RETRY" }
  | { type: "BACK" }
  | { type: "COMPLETE" }
  | { type: "RESET" };

// ---------------------------------------------------------------------------
// Initial context
// ---------------------------------------------------------------------------

export const initialContext: BookingContext = {
  searchParams: null,
  outboundFlights: [],
  returnFlights: [],
  selectedOutbound: null,
  selectedReturn: null,
  passengers: [],
  bookingResult: null,
  allBookings: [],
  userEmail: loadLastEmail(),
  error: null,
};

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

const isOneWay = ({ context }: { context: BookingContext }) =>
  context.searchParams?.tripType === "oneWay";

const isRoundTrip = ({ context }: { context: BookingContext }) =>
  context.searchParams?.tripType === "roundTrip";

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
          cabin: "ECONOMY",
          origin: input.origin,
          destination: input.destination,
          departureDate: new Date(input.departureDate),
        });
        const flights = await Effect.runPromise(effect);
        return flights.map((f) => ({
          flightId: f.flightId.valueOf() ?? "",
          flightNumber: f.flightNumber.valueOf() ?? "",
          origin: f.origin.valueOf() ?? input.origin,
          destination: f.destination.valueOf() ?? input.destination,
          departureTime:
            f.departureTime instanceof Date
              ? f.departureTime.toISOString()
              : String(f.departureTime),
          arrivalTime:
            f.arrivalTime instanceof Date
              ? f.arrivalTime.toISOString()
              : String(f.arrivalTime),
          durationMinutes: f.durationMinutes,
          stops: f.stops,
          cabins: [
            {
              cabin: "ECONOMY" as CabinClass,
              availableSeats: f.economyAvailable,
              price: f.economyPrice,
            },
            {
              cabin: "BUSINESS" as CabinClass,
              availableSeats: f.businessAvailable,
              price: f.businessPrice,
            },
            {
              cabin: "FIRST" as CabinClass,
              availableSeats: f.firstAvailable,
              price: f.firstPrice,
            },
          ],
          lastUpdated:
            f.lastUpdated instanceof Date
              ? f.lastUpdated.toISOString()
              : String(f.lastUpdated),
        }));
      },
    ),
    searchReturnFlights: fromPromise(
      async ({
        input,
      }: {
        input: SearchParams;
      }): Promise<Array<FlightResult>> => {
        const returnDate = input.returnDate;
        if (!returnDate) return [];
        const effect = findAvailableFlights({
          cabin: "ECONOMY",
          origin: input.destination,
          destination: input.origin,
          departureDate: new Date(returnDate),
        });
        const flights = await Effect.runPromise(effect);
        return flights.map((f) => ({
          flightId: f.flightId.valueOf() ?? "",
          flightNumber: f.flightNumber.valueOf() ?? "",
          origin: f.origin.valueOf() ?? input.destination,
          destination: f.destination.valueOf() ?? input.origin,
          departureTime:
            f.departureTime instanceof Date
              ? f.departureTime.toISOString()
              : String(f.departureTime),
          arrivalTime:
            f.arrivalTime instanceof Date
              ? f.arrivalTime.toISOString()
              : String(f.arrivalTime),
          durationMinutes: f.durationMinutes,
          stops: f.stops,
          cabins: [
            {
              cabin: "ECONOMY" as CabinClass,
              availableSeats: f.economyAvailable,
              price: f.economyPrice,
            },
            {
              cabin: "BUSINESS" as CabinClass,
              availableSeats: f.businessAvailable,
              price: f.businessPrice,
            },
            {
              cabin: "FIRST" as CabinClass,
              availableSeats: f.firstAvailable,
              price: f.firstPrice,
            },
          ],
          lastUpdated:
            f.lastUpdated instanceof Date
              ? f.lastUpdated.toISOString()
              : String(f.lastUpdated),
        }));
      },
    ),
    fetchBookings: fromPromise(
      async ({
        input,
      }: {
        input?: { email?: string };
      }): Promise<ReadonlyArray<BookingSummary>> => {
        try {
          const effect = getBookings(input?.email);
          const bookings = (await Effect.runPromise(
            effect,
          )) as ReadonlyArray<BookingResponse>;
          return bookings.map((b) => ({
            id: b.id,
            pnrCode: b.pnrCode,
            status: b.status,
            passengerCount: 1,
            totalPrice: b.segments.reduce<Money>(
              (acc, seg: BookingSegment) => {
                const rawPrice = seg.price as unknown as {
                  amount: number;
                  currency: CurrencyCode;
                };
                const price =
                  seg.price instanceof Money
                    ? seg.price
                    : Money.of(rawPrice.amount, rawPrice.currency);
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
          segments: Array<{ flightId: string; cabinClass: CabinClass }>;
          passengers: ReadonlyArray<PassengerInput>;
        };
      }): Promise<BookingResult> => {
        if (input.passengers.length === 0) {
          throw new Error("No passengers provided");
        }

        const mappedPassengers = input.passengers.map((p) => ({
          id: uuidv4(),
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          dateOfBirth: p.dateOfBirth,
          gender: p.gender,
          type: derivePassengerType(p.dateOfBirth),
        }));

        const command: BookFlightCommand = {
          segments: input.segments as unknown as BookFlightCommand["segments"],
          passengers:
            mappedPassengers as unknown as BookFlightCommand["passengers"],
          successUrl: `${window.location.origin}/success?pnr={{PNR}}`,
          cancelUrl: `${window.location.origin}/cancel`,
        };

        const effect = bookFlight(command);
        const response = await Effect.runPromise(Effect.scoped(effect));

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
          checkoutUrl: response.checkoutUrl,
        };
      },
    ),
  },
  actions: {
    persistEmail: assign({
      ...initialContext,
      passengers: ({ context }) => context.passengers,
      bookingResult: ({ context }) =>
        context.bookingResult
          ? { ...context.bookingResult, status: "CONFIRMED" }
          : null,
      userEmail: ({ context }) => {
        const email = context.passengers[0]?.email ?? context.userEmail;
        if (email) {
          saveLastEmail(email);
        }
        return email;
      },
    }),
  },
  guards: {
    isOneWay,
    isRoundTrip,
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
            outboundFlights: () => [],
            returnFlights: () => [],
            selectedOutbound: () => null,
            selectedReturn: () => null,
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
      invoke: {
        src: "fetchBookings",
        input: ({ context }) =>
          context.userEmail ? { email: context.userEmail } : {},
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
          target: "selectingOutbound",
          actions: assign({
            outboundFlights: ({ event }) => event.output,
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

    selectingOutbound: {
      on: {
        SELECT_OUTBOUND: [
          {
            guard: "isOneWay",
            target: "enteringPassengers",
            actions: assign({
              selectedOutbound: ({ event }) => event.selection,
            }),
          },
          {
            target: "searchingReturn",
            actions: assign({
              selectedOutbound: ({ event }) => event.selection,
            }),
          },
        ],
        CHANGE_OUTBOUND_DATE: {
          target: "searching",
          actions: assign({
            searchParams: ({ context, event }) =>
              context.searchParams
                ? { ...context.searchParams, departureDate: event.date }
                : null,
            outboundFlights: () => [],
            selectedOutbound: () => null,
          }),
        },
        SEARCH: {
          target: "searching",
          actions: assign({
            searchParams: ({ event }) => event.params,
            outboundFlights: () => [],
            returnFlights: () => [],
            selectedOutbound: () => null,
            selectedReturn: () => null,
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

    searchingReturn: {
      tags: ["loading"],
      invoke: {
        src: "searchReturnFlights",
        input: ({ context }) => context.searchParams as SearchParams,
        onDone: {
          target: "selectingReturn",
          actions: assign({
            returnFlights: ({ event }) => event.output,
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Return flight search failed",
          }),
        },
      },
    },

    selectingReturn: {
      on: {
        SELECT_RETURN: {
          target: "enteringPassengers",
          actions: assign({
            selectedReturn: ({ event }) => event.selection,
          }),
        },
        CHANGE_RETURN_DATE: {
          target: "searchingReturn",
          actions: assign({
            searchParams: ({ context, event }) =>
              context.searchParams
                ? { ...context.searchParams, returnDate: event.date }
                : null,
            returnFlights: () => [],
            selectedReturn: () => null,
          }),
        },
        BACK: {
          target: "selectingOutbound",
          actions: assign({ selectedReturn: () => null }),
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
          target: "reviewingSummary",
          actions: assign({
            passengers: ({ event }) => event.passengers,
          }),
        },
        BACK: [
          {
            guard: "isOneWay",
            target: "selectingOutbound",
            actions: assign({ passengers: () => [] }),
          },
          {
            target: "selectingReturn",
            actions: assign({ passengers: () => [] }),
          },
        ],
        ERROR: {
          target: "error",
          actions: assign({ error: ({ event }) => event.message }),
        },
        RESET: { target: "idle", actions: assign(initialContext) },
      },
    },

    reviewingSummary: {
      on: {
        CONFIRM_PAYMENT: "paying",
        BACK: "enteringPassengers",
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
        input: ({ context }) => {
          const segments: Array<{ flightId: string; cabinClass: CabinClass }> =
            [];
          if (context.selectedOutbound) {
            segments.push({
              flightId: context.selectedOutbound.flight.flightId,
              cabinClass: context.selectedOutbound.cabin,
            });
          }
          if (context.selectedReturn) {
            segments.push({
              flightId: context.selectedReturn.flight.flightId,
              cabinClass: context.selectedReturn.cabin,
            });
          }
          return {
            segments,
            passengers: context.passengers,
          };
        },
        onDone: [
          {
            guard: ({ event }) => Boolean(event.output.checkoutUrl),
            target: "redirecting",
            actions: assign({
              bookingResult: ({ event }) => event.output,
              error: () => null,
            }),
          },
          {
            target: "confirmed",
            actions: assign({
              bookingResult: ({ event }) => event.output,
              error: () => null,
            }),
          },
        ],
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
          target: "reviewingSummary",
        },
        RESET: { target: "idle", actions: assign(initialContext) },
      },
    },

    redirecting: {
      entry: ({ context }) => {
        if (context.bookingResult?.checkoutUrl) {
          window.location.href = context.bookingResult.checkoutUrl;
        }
      },
      on: {
        COMPLETE: "confirmed",
        RESET: { target: "idle", actions: assign(initialContext) },
      },
    },

    confirmed: {
      entry: [
        "persistEmail",
        ({ context }) => {
          // Only redirect if somehow we already have a checkoutUrl and we are confirmed (unlikely in this flow)
          if (
            context.bookingResult?.checkoutUrl &&
            !window.location.pathname.startsWith("/confirmation")
          ) {
            window.location.href = context.bookingResult.checkoutUrl;
          }
        },
      ],
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
  | "selectingOutbound"
  | "searchingReturn"
  | "selectingReturn"
  | "enteringPassengers"
  | "reviewingSummary"
  | "paying"
  | "redirecting"
  | "confirmed"
  | "error";

/** Map machine state to booking flow step index (0-based) */
export const stateToStep = (state: BookingStateValue): number => {
  const mapping: Record<BookingStateValue, number> = {
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
  return mapping[state];
};

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
    case "selectingOutbound":
      return "/outbound";
    case "searchingReturn":
    case "selectingReturn":
      return "/return";
    case "enteringPassengers":
      return "/passengers";
    case "reviewingSummary":
    case "paying":
    case "redirecting":
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
  if (path === "/outbound") return "selectingOutbound";
  if (path === "/return") return "selectingReturn";
  if (path === "/passengers") return "enteringPassengers";
  if (path === "/payment") return "paying";
  if (path.startsWith("/success")) return "confirmed";
  if (path.startsWith("/confirmation/")) return "confirmed";
  return null;
};

/** Helper to create a FlightSelection from a FlightResult and cabin */
export const createFlightSelection = (
  flight: FlightResult,
  cabin: CabinClass,
): FlightSelection | null => {
  const cabinData = flight.cabins.find((c) => c.cabin === cabin);
  if (!cabinData) return null;
  return {
    flight,
    cabin,
    price: cabinData.price,
  };
};
