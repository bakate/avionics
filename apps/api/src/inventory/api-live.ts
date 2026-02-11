import { HttpApiBuilder } from "@effect/platform";
import { InventoryQueries } from "@workspace/application/inventory-queries";
import * as Errors from "@workspace/domain/errors";
import { makeFlightId } from "@workspace/domain/kernel";
import { Effect } from "effect";
import { Api } from "../api.js";

const withInventoryQueries = <A, E, R>(
  fn: (queries: typeof InventoryQueries.Service) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const queries = yield* InventoryQueries;
    return yield* fn(queries);
  });

const ensureInventoryErrors =
  (flightId: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, any, R> =>
    effect.pipe(
      Effect.catchAll((e: unknown) => {
        if (e && typeof e === "object" && "_tag" in e) {
          const err = e as { readonly _tag: string; readonly message?: string };
          const allowedTags = [
            "FlightNotFoundError",
            "InventoryPersistenceError",
            "ValidationError",
          ];
          if (allowedTags.includes(err._tag)) {
            return Effect.fail(e);
          }
          return Effect.fail(
            new Errors.InventoryPersistenceError({
              flightId,
              reason: err.message || err._tag,
            }),
          );
        }
        return Effect.fail(
          new Errors.InventoryPersistenceError({
            flightId,
            reason: e instanceof Error ? e.message : String(e),
          }),
        );
      }),
    );

export const InventoryApiLive = HttpApiBuilder.group(
  Api,
  "inventory",
  (handlers) =>
    handlers
      .handle("getFlightAvailability", ({ path }) =>
        withInventoryQueries((queries) =>
          queries.getFlightAvailability(makeFlightId(path.flightId)),
        ).pipe(ensureInventoryErrors(path.flightId)),
      )
      .handle("getCabinAvailability", ({ path }) =>
        withInventoryQueries((queries) =>
          queries.getCabinAvailability(makeFlightId(path.flightId), path.cabin),
        ).pipe(ensureInventoryErrors(path.flightId)),
      )
      .handle("findAvailableFlights", ({ urlParams }) =>
        Effect.gen(function* () {
          // Validate co-dependency of origin and destination
          if (
            (urlParams.origin && !urlParams.destination) ||
            (!urlParams.origin && urlParams.destination)
          ) {
            return yield* Effect.fail(
              new Errors.ValidationError({
                reason:
                  "Both origin and destination must be provided together for a route-based search.",
                field: "route",
              }),
            );
          }

          return yield* withInventoryQueries((queries) =>
            queries.findAvailableFlights({
              cabin: urlParams.cabin,
              minSeats: urlParams.minSeats ?? 1,
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
            }),
          );
        }).pipe(ensureInventoryErrors("search")),
      )
      .handle("getInventoryStats", () =>
        withInventoryQueries((queries) => queries.getInventoryStats()).pipe(
          ensureInventoryErrors("stats"),
        ),
      ),
);
