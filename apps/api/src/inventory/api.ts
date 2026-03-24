import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import {
  CabinAvailability,
  FlightAvailability,
  InventoryStats,
} from "@workspace/application/read-models";
import * as Errors from "@workspace/domain/errors";
import { CabinClassSchema } from "@workspace/domain/kernel";
import { Schema } from "effect";

export class InventoryGroup extends HttpApiGroup.make("inventory")
  .add(
    HttpApiEndpoint.get("getFlightAvailability", "/availability/:flightId")
      .setPath(Schema.Struct({ flightId: Schema.String }))
      .addSuccess(FlightAvailability)
      .addError(Errors.FlightNotFoundError, { status: 404 })
      .addError(Errors.InventoryPersistenceError, { status: 500 }),
  )
  .add(
    HttpApiEndpoint.get(
      "getCabinAvailability",
      "/availability/:flightId/:cabin",
    )
      .setPath(
        Schema.Struct({ flightId: Schema.String, cabin: CabinClassSchema }),
      )
      .addSuccess(CabinAvailability)
      .addError(Errors.FlightNotFoundError, { status: 404 })
      .addError(Errors.InventoryPersistenceError, { status: 500 }),
  )
  .add(
    HttpApiEndpoint.get("findAvailableFlights", "/search")
      .setUrlParams(
        Schema.Struct({
          cabinClass: CabinClassSchema,
          minSeats: Schema.optional(
            Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
          ),
          departureDate: Schema.optional(Schema.Date),
          origin: Schema.optional(Schema.String),
          destination: Schema.optional(Schema.String),
          limit: Schema.optional(
            Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
          ),
          sortBy: Schema.optional(Schema.String),
        }).pipe(
          Schema.filter(
            (params) =>
              (params.origin !== undefined &&
                params.destination !== undefined) ||
              (params.origin === undefined && params.destination === undefined),
            {
              message: () =>
                "Route parameters (origin/destination) must be provided together.",
            },
          ),
        ),
      )
      .addSuccess(Schema.Array(FlightAvailability))
      .addError(Errors.ValidationError, { status: 422 })
      .addError(Errors.InventoryPersistenceError, { status: 500 }),
  )
  .add(
    HttpApiEndpoint.get("getInventoryStats", "/stats")
      .addSuccess(InventoryStats)
      .addError(Errors.InventoryPersistenceError, { status: 500 }),
  )
  .prefix("/inventory") {}
