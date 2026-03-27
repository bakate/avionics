import { type BookFlightCommand } from "@workspace/application/booking.commands";
import { type FlightAvailability } from "@workspace/application/read-models";
import { type CabinClass } from "@workspace/domain/kernel";
import { Effect, Either } from "effect";
import { v4 as uuidv4 } from "uuid";
import { fromPromise } from "xstate";
import { bookFlight } from "@/api/booking.api";
import { ApiRuntime } from "@/api/client";
import {
  findAvailableFlights,
  getFlightAvailability,
} from "@/api/inventory.api";
import { fromEffect } from "@/lib/xstate-effect";

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------
const executeStressTest = fromEffect(
  (input: {
    readonly flightId: string;
    readonly cabinClass: CabinClass;
    readonly requestCount: number;
  }) =>
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
              gender: "MALE" as const,
              type: "ADULT" as const,
            },
          ];

          const command = {
            segments: [
              { flightId: input.flightId, cabinClass: input.cabinClass },
            ],
            passengers: mappedPassengers,
            successUrl: `${window.location.origin}/success?pnr={{PNR}}`,
            cancelUrl: `${window.location.origin}/cancel`,
            simulate: true,
          } as unknown as BookFlightCommand;

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
          const errorObj = error as unknown as { _tag?: string };
          const tag = errorObj?._tag;

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

import { type FlightResult } from "@workspace/application/stress-test-types";

const fetchAvailableFlights = fromPromise<
  ReadonlyArray<FlightResult>,
  undefined
>(async () => {
  const results = await ApiRuntime.runPromise(
    findAvailableFlights({
      cabin: "ECONOMY",
      limit: 12,
      sortBy: "availableSeatsAsc",
    }),
  );

  return (results as ReadonlyArray<FlightAvailability>).map((flight) => ({
    flightId: String(flight.flightId),
    flightNumber: String(flight.flightNumber),
    origin: String(flight.origin),
    destination: String(flight.destination),
    departureTime:
      flight.departureTime instanceof Date
        ? flight.departureTime.toISOString()
        : String(flight.departureTime),
    availableSeats: Number(flight.economyAvailable),
  }));
});

const fetchSingleFlight = fromEffect((input: { readonly flightId: string }) =>
  Effect.gen(function* () {
    const flight = yield* getFlightAvailability(input.flightId, false);

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
    } as FlightResult;
  }),
);

import { createStressTestMachine } from "@workspace/application/stress-test-machine";

// ---------------------------------------------------------------------------
// Machine Injection
// ---------------------------------------------------------------------------
export const stressTestMachine = createStressTestMachine({
  actors: {
    executeStressTest,
    fetchAvailableFlights,
    fetchSingleFlight,
  },
});
