import { type BookFlightCommand } from "@workspace/application/booking.commands";
import { type CabinClass } from "@workspace/domain/kernel";
import { Effect, Either } from "effect";
import { v4 as uuidv4 } from "uuid";
import { assign, setup } from "xstate";
import { bookFlight } from "@/api/booking.api";
import {
  findAvailableFlights,
  getFlightAvailability,
} from "@/api/inventory.api";
import { fromEffect } from "@/lib/xstate-effect";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
export type FlightResult = {
  flightId: string;
  flightNumber: string;
  destination: string;
  origin: string;
  departureTime: string;
  availableSeats: number;
};

export type StressTestContext = {
  flights: Array<FlightResult>;
  flightId: string;
  requestCount: number;
  cabinClass: CabinClass;
  status: "idle" | "running" | "completed" | "error";
  results: {
    total: number;
    success: number;
    flightFull: number;
    optimisticLocking: number;
    otherErrors: number;
  } | null;
  error: string | null;
};

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------
const executeStressTest = fromEffect(
  (input: { flightId: string; cabinClass: CabinClass; requestCount: number }) =>
    Effect.gen(function* () {
      // Create requests
      const requests = Array.from({ length: input.requestCount }).map(
        (_, passengerIndex) => {
          const passengerId = uuidv4();

          const mappedPassengers = [
            {
              id: passengerId,
              firstName: "Stress",
              lastName: `Test${passengerIndex}`,
              email: `stress.test${passengerIndex}@example.com`,
              dateOfBirth: new Date("2000-01-01"),
              gender: "MALE",
              type: "ADULT",
            },
          ];

          const command: BookFlightCommand = {
            segments: [
              { flightId: input.flightId, cabinClass: input.cabinClass },
            ] as unknown as BookFlightCommand["segments"],
            passengers:
              mappedPassengers as unknown as BookFlightCommand["passengers"],
            successUrl: `${window.location.origin}/success?pnr={{PNR}}`,
            cancelUrl: `${window.location.origin}/cancel`,
            simulate: true,
          };

          return bookFlight(command).pipe(Effect.either);
        },
      );

      // Run concurrently with unbounded concurrency
      const eithers = yield* Effect.all(requests, { concurrency: "unbounded" });

      // Analyze results
      let success = 0;
      let flightFull = 0;
      let optimisticLocking = 0;
      let otherErrors = 0;

      for (const result of eithers) {
        if (Either.isRight(result)) {
          success++;
        } else {
          const error = result.left;
          const tag = (error as any)?._tag;

          if (tag === "FlightFullError") {
            flightFull++;
          } else if (tag === "OptimisticLockingError") {
            optimisticLocking++;
          } else {
            otherErrors++;
          }
        }
      }

      return {
        total: input.requestCount,
        success,
        flightFull,
        optimisticLocking,
        otherErrors,
      };
    }),
);

const fetchAvailableFlights = fromEffect(() =>
  Effect.gen(function* () {
    const results = yield* findAvailableFlights({
      cabin: "ECONOMY",
      departureDate: new Date(),
      limit: 12,
      sortBy: "availableSeatsAsc",
    });

    return results.map((flight) => ({
      flightId: flight.flightId.valueOf() ?? "",
      flightNumber: flight.flightNumber.valueOf() ?? "",
      origin: flight.origin.valueOf() ?? "",
      destination: flight.destination.valueOf() ?? "",
      departureTime:
        flight.departureTime instanceof Date
          ? flight.departureTime.toISOString()
          : String(flight.departureTime),
      availableSeats: flight.economyAvailable,
    }));
  }),
);

const fetchSingleFlight = fromEffect((input: { flightId: string }) =>
  Effect.gen(function* () {
    const flight = yield* getFlightAvailability(input.flightId);

    return {
      flightId: flight.flightId.valueOf() ?? "",
      flightNumber: flight.flightNumber.valueOf() ?? "",
      origin: flight.origin.valueOf() ?? "",
      destination: flight.destination.valueOf() ?? "",
      departureTime:
        flight.departureTime instanceof Date
          ? flight.departureTime.toISOString()
          : String(flight.departureTime),
      availableSeats: flight.economyAvailable,
    };
  }),
);

// ---------------------------------------------------------------------------
// Machine
// ---------------------------------------------------------------------------
export const stressTestMachine = setup({
  types: {
    context: {} as StressTestContext,
    events: {} as
      | { type: "SET_FLIGHT_ID"; flightId: string }
      | { type: "SET_REQUEST_COUNT"; count: number }
      | { type: "RUN_TEST" }
      | { type: "RESET" },
  },
  actors: {
    executeStressTest,
    fetchAvailableFlights,
    fetchSingleFlight,
  },
}).createMachine({
  id: "stressTest",
  initial: "fetchingFlights",
  context: {
    flights: [],
    flightId: "",
    requestCount: 20,
    cabinClass: "ECONOMY",
    status: "idle",
    results: null,
    error: null,
  },
  on: {
    SET_FLIGHT_ID: {
      actions: assign({ flightId: ({ event }) => event.flightId }),
    },
    SET_REQUEST_COUNT: {
      actions: assign({ requestCount: ({ event }) => event.count }),
    },
    RESET: {
      target: ".idle",
      actions: assign({
        status: "idle",
        results: null,
        error: null,
        flightId: "", // Optional: clear selected flight on reset
      }),
    },
  },
  states: {
    fetchingFlights: {
      tags: ["loading"],
      invoke: {
        src: "fetchAvailableFlights",
        onDone: {
          target: "idle",
          actions: assign({
            flights: ({ event }) => event.output,
          }),
        },
        onError: {
          target: "idle", // Gracefully degrade if API fails, UI will show empty list
          actions: assign({
            error: () => "Failed to fetch available flights",
          }),
        },
      },
    },
    idle: {
      on: {
        RUN_TEST: {
          target: "running",
          guard: ({ context }) =>
            context.flightId.length > 0 && context.requestCount > 0,
        },
      },
      tags: ["idle"],
    },
    running: {
      tags: ["loading"],
      entry: assign({ status: "running", results: null, error: null }),
      invoke: {
        src: "executeStressTest",
        input: ({ context }) => ({
          flightId: context.flightId,
          cabinClass: context.cabinClass,
          requestCount: context.requestCount,
        }),
        onDone: {
          target: "completed",
          actions: assign({
            status: "completed",
            results: ({ event }) => event.output,
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            status: "error",
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Stress test failed",
          }),
        },
      },
    },
    completed: {
      tags: ["completed"],
      // Fetch only the targeted flight to update its seat counts efficiently
      invoke: {
        src: "fetchSingleFlight",
        input: ({ context }) => ({ flightId: context.flightId }),
        onDone: {
          actions: assign({
            flights: ({ context, event }) =>
              context.flights.map((flight) =>
                flight.flightId === event.output.flightId
                  ? event.output
                  : flight,
              ),
          }),
        },
      },
      on: {
        RESET: {
          target: "idle",
          actions: assign({
            status: "idle",
            results: null,
            error: null,
          }),
        },
        RUN_TEST: {
          target: "running",
          guard: ({ context }) =>
            context.flightId.length > 0 && context.requestCount > 0,
        },
      },
    },
    error: {
      tags: ["error"],
    },
  },
});
