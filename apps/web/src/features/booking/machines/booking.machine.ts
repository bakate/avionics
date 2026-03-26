/**
 * Booking Machine — xstate v5 state machine orchestrating the Air France-style booking flow.
 *
 * States: idle → searching → selectingOutbound → searchingReturn → selectingReturn
 *   → enteringPassengers → paying → confirmed | error
 *
 */

import { type BookingResponse } from "@workspace/api/booking-api";
export type { BookingResponse };

import { type BookFlightCommand } from "@workspace/application/booking.commands";
import { type BookingSummary } from "@workspace/application/read-models";
export type { BookingSummary };

import { BookingStatusSchema, PnrStatus } from "@workspace/domain/booking";
import {
  BookingId,
  type CabinClass,
  CabinClassSchema,
  type CurrencyCode,
  CurrencyCodeSchema,
  FlightId,
  Money,
  type PassengerType,
  PnrCodeSchema,
} from "@workspace/domain/kernel";
import { type BookingSegment } from "@workspace/domain/segment";
import { Effect, Schema } from "effect";
import { v4 as uuidv4 } from "uuid";
import { assign, setup } from "xstate";
import {
  bookFlight,
  cancelBooking,
  confirmBooking,
  getBookingByPnr,
  getBookings,
} from "@/api/booking.api";
import { findAvailableFlights } from "@/api/inventory.api";
import { fromEffect } from "@/lib/xstate-effect";
import { type PassengerInput } from "../schemas/passenger.schema";
import { type SearchParams } from "../schemas/search.schema";
import {
  type FilterState,
  type SortField,
  type SortOrder,
} from "../schemas/ui.schema";
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
  flightId: FlightId,
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
      price: Schema.Struct({
        amount: Schema.Number,
        currency: CurrencyCodeSchema,
      }),
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
    bookingId: BookingId,
    pnrCode: PnrCodeSchema,
    status: BookingStatusSchema,
    totalPrice: Schema.Struct({
      amount: Schema.Number,
      currency: CurrencyCodeSchema,
    }),
    confirmedAt: Schema.String,
    checkoutUrl: Schema.Union(Schema.String, Schema.Undefined),
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
  currentBooking: BookingResponse | null;
  pnrToFetch: string | null;
  userEmail: string | null;
  error: string | null;

  // UI State
  filters: FilterState;
  sortField: SortField;
  sortOrder: SortOrder;

  activeAction: {
    id: string;
    type: "confirm" | "cancel";
  } | null;
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type BookingEvent =
  | { type: "SEARCH"; params: SearchParams }
  | { type: "FETCH_BOOKINGS"; email?: string | undefined }
  | { type: "FETCH_BOOKING_DETAILS"; pnr: string }
  | { type: "SELECT_OUTBOUND"; selection: FlightSelection }
  | { type: "SELECT_RETURN"; selection: FlightSelection }
  | { type: "SET_PASSENGERS"; passengers: ReadonlyArray<PassengerInput> }
  | { type: "CONFIRM_PAYMENT" }
  | { type: "CONFIRM_BOOKING_ACTION"; id: string }
  | { type: "CANCEL_BOOKING_ACTION"; id: string; reason: string }
  | { type: "CHANGE_OUTBOUND_DATE"; date: string }
  | { type: "CHANGE_RETURN_DATE"; date: string }
  | { type: "ERROR"; message: string }
  | { type: "RETRY" }
  | { type: "BACK" }
  | { type: "COMPLETE" }
  | { type: "RESET" }
  | { type: "UPDATE_FILTERS"; filters: FilterState }
  | { type: "UPDATE_SORT"; field: SortField; order: SortOrder }
  | { type: "RESET_FILTERS" };

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
  currentBooking: null,
  pnrToFetch: null,
  userEmail: loadLastEmail(),
  error: null,
  activeAction: null,
  filters: { cabinClass: "ECONOMY", maxStops: null, timeRange: null },
  sortField: "price",
  sortOrder: "asc",
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

const machineSetup = setup({
  types: {
    context: {} as BookingContext,
    events: {} as BookingEvent,
  },
  actors: {
    searchFlights: fromEffect((input: SearchParams) =>
      Effect.gen(function* () {
        const flights = yield* findAvailableFlights({
          cabin: "ECONOMY",
          origin: input.origin,
          destination: input.destination,
          departureDate: new Date(input.departureDate),
        });

        return flights.map(
          (flight) =>
            new FlightResult({
              flightId: FlightId.make(flight.flightId.valueOf() ?? ""),
              flightNumber: flight.flightNumber.valueOf() ?? "",
              origin: flight.origin.valueOf() ?? input.origin,
              destination: flight.destination.valueOf() ?? input.destination,
              departureTime:
                flight.departureTime instanceof Date
                  ? flight.departureTime.toISOString()
                  : String(flight.departureTime),
              arrivalTime:
                flight.arrivalTime instanceof Date
                  ? flight.arrivalTime.toISOString()
                  : String(flight.arrivalTime),
              durationMinutes: flight.durationMinutes,
              stops: flight.stops,
              cabins: [
                {
                  cabin: "ECONOMY" as CabinClass,
                  availableSeats: flight.economyAvailable,
                  price: {
                    amount: flight.economyPrice.amount,
                    currency: flight.economyPrice.currency as CurrencyCode,
                  },
                },
                {
                  cabin: "BUSINESS" as CabinClass,
                  availableSeats: flight.businessAvailable,
                  price: {
                    amount: flight.businessPrice.amount,
                    currency: flight.businessPrice.currency as CurrencyCode,
                  },
                },
                {
                  cabin: "FIRST" as CabinClass,
                  availableSeats: flight.firstAvailable,
                  price: {
                    amount: flight.firstPrice.amount,
                    currency: flight.firstPrice.currency as CurrencyCode,
                  },
                },
              ],
              lastUpdated:
                flight.lastUpdated instanceof Date
                  ? flight.lastUpdated.toISOString()
                  : String(flight.lastUpdated),
            }),
        );
      }),
    ),
    searchReturnFlights: fromEffect((input: SearchParams) =>
      Effect.gen(function* () {
        const returnDate = input.returnDate;
        if (!returnDate) return [];

        const flights = yield* findAvailableFlights({
          cabin: "ECONOMY",
          origin: input.destination,
          destination: input.origin,
          departureDate: new Date(returnDate),
        });

        return flights.map(
          (flight) =>
            new FlightResult({
              flightId: FlightId.make(flight.flightId.valueOf() ?? ""),
              flightNumber: flight.flightNumber.valueOf() ?? "",
              origin: flight.origin.valueOf() ?? input.destination,
              destination: flight.destination.valueOf() ?? input.origin,
              departureTime:
                flight.departureTime instanceof Date
                  ? flight.departureTime.toISOString()
                  : String(flight.departureTime),
              arrivalTime:
                flight.arrivalTime instanceof Date
                  ? flight.arrivalTime.toISOString()
                  : String(flight.arrivalTime),
              durationMinutes: flight.durationMinutes,
              stops: flight.stops,
              cabins: [
                {
                  cabin: "ECONOMY" as CabinClass,
                  availableSeats: flight.economyAvailable,
                  price: {
                    amount: flight.economyPrice.amount,
                    currency: flight.economyPrice.currency as CurrencyCode,
                  },
                },
                {
                  cabin: "BUSINESS" as CabinClass,
                  availableSeats: flight.businessAvailable,
                  price: {
                    amount: flight.businessPrice.amount,
                    currency: flight.businessPrice.currency as CurrencyCode,
                  },
                },
                {
                  cabin: "FIRST" as CabinClass,
                  availableSeats: flight.firstAvailable,
                  price: {
                    amount: flight.firstPrice.amount,
                    currency: flight.firstPrice.currency as CurrencyCode,
                  },
                },
              ],
              lastUpdated:
                flight.lastUpdated instanceof Date
                  ? flight.lastUpdated.toISOString()
                  : String(flight.lastUpdated),
            }),
        );
      }),
    ),
    fetchBookings: fromEffect((input?: { email?: string }) =>
      Effect.gen(function* () {
        const response = yield* getBookings(input?.email);
        const bookings = response as ReadonlyArray<BookingResponse>;

        return bookings.map((booking) => ({
          id: BookingId.make(booking.id.valueOf() ?? ""),
          pnrCode: PnrCodeSchema.make(booking.pnrCode.valueOf() ?? ""),
          status: booking.status as PnrStatus,
          passengerCount: 1,
          totalPrice: booking.segments.reduce<Money>(
            (acc, segment: BookingSegment) => {
              const rawPrice = segment.price as unknown as {
                amount: number;
                currency: CurrencyCode;
              };
              const price =
                segment.price instanceof Money
                  ? segment.price
                  : Money.of(rawPrice.amount, rawPrice.currency);
              return acc.add(price);
            },
            Money.zero(booking.segments[0]?.price.currency ?? "EUR"),
          ),
          createdAt: booking.createdAt,
          expiresAt: booking.expiresAt,
        }));
      }).pipe(
        Effect.tapError((error) =>
          Effect.logError("Failed to fetch bookings", error),
        ),
      ),
    ),
    fetchBookingDetails: fromEffect((input: { pnr: string }) =>
      getBookingByPnr(input.pnr),
    ),
    submitBooking: fromEffect(
      (input: {
        segments: Array<{ flightId: string; cabinClass: CabinClass }>;
        passengers: ReadonlyArray<PassengerInput>;
      }) =>
        Effect.gen(function* () {
          if (input.passengers.length === 0) {
            return yield* Effect.fail(new Error("No passengers provided"));
          }

          const mappedPassengers = input.passengers.map((passenger) => ({
            id: uuidv4(),
            firstName: passenger.firstName,
            lastName: passenger.lastName,
            email: passenger.email,
            dateOfBirth: passenger.dateOfBirth,
            gender: passenger.gender,
            type: derivePassengerType(passenger.dateOfBirth),
          }));

          const command: BookFlightCommand = {
            segments:
              input.segments as unknown as BookFlightCommand["segments"],
            passengers:
              mappedPassengers as unknown as BookFlightCommand["passengers"],
            successUrl: `${window.location.origin}/success?pnr={{PNR}}`,
            cancelUrl: `${window.location.origin}/cancel`,
          };

          const response = yield* Effect.scoped(bookFlight(command));

          const totalPrice = response.booking.segments.reduce(
            (sum, segment) => sum.add(segment.price),
            Money.zero(response.booking.segments[0]?.price.currency ?? "EUR"),
          );

          return new BookingResult({
            bookingId: response.booking.id,
            pnrCode: response.booking.pnrCode,
            status: response.booking.status,
            totalPrice: {
              amount: totalPrice.amount,
              currency: totalPrice.currency as CurrencyCode,
            },
            confirmedAt: response.booking.createdAt.toISOString(),
            checkoutUrl: response.checkoutUrl,
          });
        }),
    ),
    confirmBooking: fromEffect((input: { id: string }) =>
      confirmBooking(input.id),
    ),
    cancelBooking: fromEffect((input: { id: string; reason: string }) =>
      cancelBooking(input.id, input.reason),
    ),
  },
  actions: {
    persistEmail: assign(({ context }) => {
      const email = context.passengers[0]?.email ?? context.userEmail;
      if (email) {
        saveLastEmail(email);
      }
      return {
        // Clear flow but KEEP critical data
        searchParams: null,
        outboundFlights: [],
        returnFlights: [],
        selectedOutbound: null,
        selectedReturn: null,
        error: null,
        activeAction: null,
        // We KEEP userEmail and allBookings
        userEmail: email,
        allBookings: context.allBookings,
        // Preserve confirmed status in result
        bookingResult: context.bookingResult
          ? { ...context.bookingResult, status: PnrStatus.CONFIRMED }
          : null,
      };
    }),
    resetBookingFlow: assign(({ context }) => ({
      ...initialContext,
      allBookings: context.allBookings,
      userEmail: context.userEmail,
    })),
  },
  guards: {
    isOneWay,
    isRoundTrip,
  },
});

export const bookingMachine = machineSetup.createMachine({
  id: "booking",
  initial: "idle",
  context: initialContext,

  on: {
    UPDATE_FILTERS: {
      actions: assign({
        filters: ({ event }) => event.filters,
      }),
    },
    UPDATE_SORT: {
      actions: assign({
        sortField: ({ event }) => event.field,
        sortOrder: ({ event }) => event.order,
      }),
    },
    RESET_FILTERS: {
      actions: assign({
        filters: () => ({
          cabinClass: "ECONOMY",
          maxStops: null,
          timeRange: null,
        }),
        sortField: () => "price",
        sortOrder: () => "asc",
      }),
    },
    CONFIRM_BOOKING_ACTION: {
      target: "#booking.performingAction",
      actions: assign({
        activeAction: ({ event }) => ({
          id: event.id,
          type: "confirm" as const,
        }),
      }),
    },
    CANCEL_BOOKING_ACTION: {
      target: "#booking.performingAction",
      actions: assign({
        activeAction: ({ event }) => ({
          id: event.id,
          type: "cancel" as const,
        }),
      }),
    },
    FETCH_BOOKINGS: {
      target: "#booking.fetchingBookings",
      actions: assign({
        userEmail: ({ context, event }) =>
          event.email ?? context.userEmail ?? "",
      }),
    },
    FETCH_BOOKING_DETAILS: {
      target: "#booking.fetchingBookingDetails",
      actions: assign({ pnrToFetch: ({ event }) => event.pnr }),
    },
    RESET: { target: "#booking.idle", actions: "resetBookingFlow" },
  },

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
            allBookings: ({ event }) =>
              event.output as unknown as ReadonlyArray<BookingSummary>,
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

    fetchingBookingDetails: {
      tags: ["loading"],
      invoke: {
        src: "fetchBookingDetails",
        input: ({ context }) => ({ pnr: context.pnrToFetch ?? "" }),
        onDone: {
          target: "viewingBookingDetails",
          actions: assign({
            currentBooking: ({ event }) =>
              event.output as unknown as BookingResponse,
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to fetch booking details",
          }),
        },
      },
    },

    viewingBookingDetails: {
      on: {
        BACK: { target: "idle" },
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
            outboundFlights: ({ event }) =>
              event.output as unknown as ReadonlyArray<FlightResult>,
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
        RESET: { target: "idle", actions: "resetBookingFlow" },
      },
    },

    selectingOutbound: {
      on: {
        SELECT_OUTBOUND: [
          {
            guard: isOneWay,
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
        RESET: { target: "idle", actions: "resetBookingFlow" },
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
            returnFlights: ({ event }) =>
              event.output as unknown as ReadonlyArray<FlightResult>,
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
        RESET: { target: "idle", actions: "resetBookingFlow" },
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
            guard: isOneWay,
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
        RESET: { target: "idle", actions: "resetBookingFlow" },
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
        RESET: { target: "idle", actions: "resetBookingFlow" },
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
              bookingResult: ({ event }) =>
                event.output as unknown as BookingResult,
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
        RESET: { target: "idle", actions: "resetBookingFlow" },
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
        RESET: { target: "idle", actions: "resetBookingFlow" },
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
        RESET: { target: "idle", actions: "resetBookingFlow" },
      },
    },

    error: {
      on: {
        RETRY: { target: "idle" },
        RESET: { target: "idle", actions: "resetBookingFlow" },
      },
    },

    performingAction: {
      tags: ["loading"],
      initial: "selecting",
      states: {
        selecting: {
          always: [
            {
              guard: ({ event }) => event.type === "CANCEL_BOOKING_ACTION",
              target: "cancelling",
            },
            {
              target: "confirming",
            },
          ],
        },
        confirming: {
          invoke: {
            src: "confirmBooking",
            input: ({ context }) => ({ id: context.activeAction?.id ?? "" }),
            onDone: {
              target: "#booking.fetchingBookings",
              actions: assign({ activeAction: () => null }),
            },
            onError: {
              target: "#booking.error",
              actions: assign({
                error: ({ event }) => (event.error as Error).message,
                activeAction: () => null,
              }),
            },
          },
        },
        cancelling: {
          invoke: {
            src: "cancelBooking",
            input: ({ context, event }) => {
              // Priority to context if we just transitioned, but event might have it if we were already there
              const id =
                context.activeAction?.id ??
                (
                  event as Extract<
                    BookingEvent,
                    { type: "CANCEL_BOOKING_ACTION" }
                  >
                ).id;
              const reason = (
                event as Extract<
                  BookingEvent,
                  { type: "CANCEL_BOOKING_ACTION" }
                >
              ).reason;
              return { id, reason: reason ?? "No reason provided" };
            },
            onDone: {
              target: "#booking.fetchingBookings",
              actions: assign({ activeAction: () => null }),
            },
            onError: {
              target: "#booking.error",
              actions: assign({
                error: ({ event }) => (event.error as Error).message,
                activeAction: () => null,
              }),
            },
          },
        },
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
  | "fetchingBookingDetails"
  | "viewingBookingDetails"
  | "searching"
  | "selectingOutbound"
  | "searchingReturn"
  | "selectingReturn"
  | "enteringPassengers"
  | "reviewingSummary"
  | "paying"
  | "redirecting"
  | "confirmed"
  | "error"
  | { performingAction: "selecting" | "confirming" | "cancelling" };

/** Map machine state to booking flow step index (0-based) */
export const stateToStep = (state: BookingStateValue): number => {
  if (typeof state === "object") {
    return 4;
  }
  const mapping: Record<string, number> = {
    idle: 0,
    fetchingBookings: 0,
    fetchingBookingDetails: 0,
    viewingBookingDetails: 0,
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
  return mapping[state] ?? 0;
};

/** Map machine state to the corresponding route path */
export const stateToRoute = (
  state: BookingStateValue,
  context: BookingContext,
): string => {
  if (typeof state === "object") {
    return "/payment";
  }
  switch (state) {
    case "idle":
    case "fetchingBookings":
    case "searching":
      return "/";
    case "fetchingBookingDetails":
    case "viewingBookingDetails":
      return `/booking/${context.pnrToFetch || "unknown"}`;
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
  if (path.startsWith("/booking/")) return "viewingBookingDetails";
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
