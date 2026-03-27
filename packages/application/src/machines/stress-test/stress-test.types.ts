import { type CabinClass } from "@workspace/domain/kernel";
import { type PromiseActorLogic } from "xstate";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
export type FlightResult = {
  readonly flightId: string;
  readonly flightNumber: string;
  readonly destination: string;
  readonly origin: string;
  readonly departureTime: string;
  readonly availableSeats: number;
};

export type StressTestResults = {
  readonly total: number;
  readonly success: number;
  readonly flightFull: number;
  readonly optimisticLocking: number;
  readonly otherErrors: number;
};

export type StressTestContext = {
  readonly flights: ReadonlyArray<FlightResult>;
  readonly flightId: string;
  readonly requestCount: number;
  readonly cabinClass: CabinClass;
  readonly status: "idle" | "running" | "completed" | "error";
  readonly results: StressTestResults | null;
  readonly error: string | null;
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export type StressTestEvent =
  | { type: "SET_FLIGHT_ID"; flightId: string }
  | { type: "SET_REQUEST_COUNT"; count: number }
  | { type: "RUN_TEST" }
  | { type: "RESET" };

// ---------------------------------------------------------------------------
// Dependency Injection Interface
// ---------------------------------------------------------------------------
export interface StressTestMachineDeps {
  readonly actors: {
    readonly executeStressTest: PromiseActorLogic<
      StressTestResults,
      {
        readonly flightId: string;
        readonly cabinClass: CabinClass;
        readonly requestCount: number;
      }
    >;
    readonly fetchAvailableFlights: PromiseActorLogic<
      ReadonlyArray<FlightResult>,
      undefined
    >;
    readonly fetchSingleFlight: PromiseActorLogic<
      FlightResult,
      { readonly flightId: string }
    >;
  };
}
