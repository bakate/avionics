import { HttpApiBuilder } from "@effect/platform";
import { InventoryQueries } from "@workspace/application/inventory-queries";
import * as Errors from "@workspace/domain/errors";
import { makeFlightId } from "@workspace/domain/kernel";
import { Effect } from "effect";
import { Api } from "../api.js";
import * as Utils from "../lib/api-utils.js";

const INVENTORY_ALLOWED_TAGS = [
  "FlightNotFoundError",
  "InventoryPersistenceError",
  "ValidationError",
] as const;

const ensureInventoryContract = (flightId: string) =>
  Utils.mapToContract(
    INVENTORY_ALLOWED_TAGS,
    (e) =>
      new Errors.InventoryPersistenceError({
        flightId,
        reason: e instanceof Error ? e.message : String(e),
      }),
  );

export const InventoryApiLive = HttpApiBuilder.group(
  Api,
  "inventory",
  (handlers) =>
    handlers
      .handle("getFlightAvailability", ({ path }) =>
        Effect.gen(function* () {
          const queries = yield* InventoryQueries;
          return yield* queries.getFlightAvailability(
            makeFlightId(path.flightId),
          );
        }).pipe(ensureInventoryContract(path.flightId)),
      )
      .handle("getCabinAvailability", ({ path }) =>
        Effect.gen(function* () {
          const queries = yield* InventoryQueries;
          return yield* queries.getCabinAvailability(
            makeFlightId(path.flightId),
            path.cabin,
          );
        }).pipe(ensureInventoryContract(path.flightId)),
      )
      .handle("findAvailableFlights", ({ urlParams }) =>
        Effect.gen(function* () {
          yield* Effect.logInfo("Searching flights", { urlParams });
          const queries = yield* InventoryQueries;
          return yield* queries.findAvailableFlights({
            cabin: urlParams.cabinClass,
            minSeats: urlParams.minSeats ?? 1,
            ...(urlParams.limit ? { limit: urlParams.limit } : {}),
            ...(urlParams.sortBy ? { sortBy: urlParams.sortBy } : {}),
            ...(urlParams.departureDate
              ? { departureDate: urlParams.departureDate }
              : {}),
            ...(urlParams.origin && urlParams.destination
              ? {
                  route: {
                    origin: urlParams.origin,
                    destination: urlParams.destination,
                  },
                }
              : {}),
          });
        }).pipe(ensureInventoryContract("search")),
      )
      .handle("getInventoryStats", () =>
        Effect.gen(function* () {
          const queries = yield* InventoryQueries;
          return yield* queries.getInventoryStats();
        }).pipe(ensureInventoryContract("stats")),
      ),
);
