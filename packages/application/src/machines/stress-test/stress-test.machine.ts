import { assign, setup } from "xstate";
import {
  type StressTestContext,
  type StressTestEvent,
  type StressTestMachineDeps,
} from "./stress-test.types";

export const createStressTestMachine = (deps: StressTestMachineDeps) => {
  return setup({
    types: {
      context: {} as StressTestContext,
      events: {} as StressTestEvent,
    },
    actors: {
      executeStressTest: deps.actors.executeStressTest,
      fetchAvailableFlights: deps.actors.fetchAvailableFlights,
      fetchSingleFlight: deps.actors.fetchSingleFlight,
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
};
