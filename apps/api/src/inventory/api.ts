import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import {
  CabinAvailability,
  FlightAvailability,
  InventoryStats,
} from "@workspace/application/read-models";
import * as Errors from "@workspace/domain/errors";
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
      .setPath(Schema.Struct({ flightId: Schema.String, cabin: Schema.String }))
      .addSuccess(CabinAvailability)
      .addError(Errors.FlightNotFoundError, { status: 404 })
      .addError(Errors.InventoryPersistenceError, { status: 500 }),
  )
  .add(
    HttpApiEndpoint.get("findAvailableFlights", "/search")
      .setUrlParams(
        Schema.Struct({
          cabin: Schema.String,
          minSeats: Schema.optional(Schema.NumberFromString),
          departureDate: Schema.optional(Schema.DateFromString),
          origin: Schema.optional(Schema.String),
          destination: Schema.optional(Schema.String),
        }),
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
