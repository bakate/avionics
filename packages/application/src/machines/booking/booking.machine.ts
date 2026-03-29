import { type CabinClass } from "@workspace/domain/kernel";
import { assign, type PromiseActorLogic, setup } from "xstate";
import { type BookingSummary } from "../../models/read-models.js";
import {
  type BookingContext,
  type BookingEvent,
  type BookingResult,
  type FlightResult,
  type FlightSelection,
  initialContext,
  type SubmitBookingInput,
} from "./booking.types.js";
import { type SearchParams } from "./schemas/search.schema.js";

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

const isOneWay = ({ context }: { context: BookingContext }) =>
  context.searchParams?.tripType === "oneWay";

const isRoundTrip = ({ context }: { context: BookingContext }) =>
  context.searchParams?.tripType === "roundTrip";

// ---------------------------------------------------------------------------
// Dependencies Factory
// ---------------------------------------------------------------------------

export interface BookingMachineDeps {
  actors: {
    searchFlights: PromiseActorLogic<ReadonlyArray<FlightResult>, SearchParams>;
    searchReturnFlights: PromiseActorLogic<
      ReadonlyArray<FlightResult>,
      SearchParams
    >;
    fetchBookings: PromiseActorLogic<
      ReadonlyArray<BookingSummary>,
      { email?: string }
    >;
    fetchBookingDetails: PromiseActorLogic<unknown, { pnr: string }>;
    submitBooking: PromiseActorLogic<BookingResult, SubmitBookingInput>;
    confirmBooking: PromiseActorLogic<unknown, { id: string }>;
    cancelBooking: PromiseActorLogic<unknown, { id: string; reason: string }>;
  };
  actions: {
    persistEmail: (email: string) => void;
    navigate: (url: string) => void; // for checkoutUrl redirection
  };
  helpers: {
    isConfirmationPage: () => boolean;
  };
  userEmailInitialLoader?: () => string | null;
}

import { PnrStatus } from "@workspace/domain/booking";

// ---------------------------------------------------------------------------
// Machine Factory
// ---------------------------------------------------------------------------

export const createBookingMachine = (deps: BookingMachineDeps) => {
  const machineSetup = setup({
    types: {
      context: {} as BookingContext,
      events: {} as BookingEvent,
    },
    actors: deps.actors,
    actions: {
      persistEmail: assign(({ context }) => {
        const email = context.passengers[0]?.email ?? context.userEmail;
        if (email) {
          deps.actions.persistEmail(email);
        }
        return {
          searchParams: null,
          outboundFlights: [],
          returnFlights: [],
          selectedOutbound: null,
          selectedReturn: null,
          error: null,
          activeAction: null,
          userEmail: email,
          allBookings: context.allBookings,
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
      redirect: ({ context }) => {
        if (context.bookingResult?.checkoutUrl) {
          deps.actions.navigate(context.bookingResult.checkoutUrl);
        }
      },
      confirmRedirectIfNeeded: ({ context }) => {
        if (
          context.bookingResult?.checkoutUrl &&
          !deps.helpers.isConfirmationPage()
        ) {
          deps.actions.navigate(context.bookingResult.checkoutUrl);
        }
      },
    },
    guards: {
      isOneWay,
      isRoundTrip,
    },
  });

  return machineSetup.createMachine({
    id: "booking",
    initial: "idle",
    context: {
      ...initialContext,
      userEmail: deps.userEmailInitialLoader
        ? deps.userEmailInitialLoader()
        : null,
    },
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
      SET_SEARCH_PARAMS: {
        actions: assign({
          searchParams: ({ context, event }) => {
            const current = context.searchParams ?? {
              tripType: "roundTrip",
              origin: "CDG",
              destination: "",
              departureDate: new Date().toISOString().split("T")[0],
              passengers: { adults: 1, children: 0, infants: 0 },
              cabinClass: "ECONOMY",
            };
            return { ...current, ...event.params } as SearchParams;
          },
        }),
      },
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
              currentBooking: ({ event }) => event.output,
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
          input: ({ context }: { context: BookingContext }) => {
            const segments: Array<{
              flightId: string;
              cabinClass: CabinClass;
            }> = [];
            if (context.selectedOutbound) {
              segments.push({
                flightId: context.selectedOutbound.flight.flightId as string,
                cabinClass: context.selectedOutbound.cabin,
              });
            }
            if (context.selectedReturn) {
              segments.push({
                flightId: context.selectedReturn.flight.flightId as string,
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
          CANCEL_PAYMENT: {
            target: "reviewingSummary",
            actions: assign({
              error: () => "payment.errorCancelled",
            }),
          },
          BACK: {
            target: "reviewingSummary",
          },
          RESET: { target: "idle", actions: "resetBookingFlow" },
        },
      },

      redirecting: {
        entry: "redirect",
        on: {
          CANCEL_PAYMENT: {
            target: "reviewingSummary",
            actions: assign({
              error: () => "payment.errorCancelled",
            }),
          },
          COMPLETE: "confirmed",
          RESET: { target: "idle", actions: "resetBookingFlow" },
        },
      },

      confirmed: {
        entry: ["persistEmail", "confirmRedirectIfNeeded"],
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
              input: ({
                context,
                event,
              }: {
                context: BookingContext;
                event: any;
              }) => {
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
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  } as FlightSelection;
};
