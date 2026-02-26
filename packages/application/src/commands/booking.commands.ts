import {
  CabinClassSchema,
  EmailSchema,
  GenderSchema,
  PassengerTypeSchema,
} from "@workspace/domain/kernel";
import { Schema } from "effect";

// ---------------------------------------------------------------------------
// Command Schema
// ---------------------------------------------------------------------------

export class BookFlightCommand extends Schema.Class<BookFlightCommand>(
  "BookFlightCommand",
)({
  segments: Schema.NonEmptyArray(
    Schema.Struct({
      flightId: Schema.String,
      cabinClass: CabinClassSchema,
      seatNumber: Schema.OptionFromNullOr(Schema.String).pipe(Schema.optional),
    }),
  ),
  passengers: Schema.NonEmptyArray(
    Schema.Struct({
      id: Schema.String,
      firstName: Schema.String,
      lastName: Schema.String,
      email: EmailSchema,
      dateOfBirth: Schema.Date,
      gender: GenderSchema,
      type: PassengerTypeSchema,
    }),
  ),
  successUrl: Schema.String, // URL for payment redirect success
  cancelUrl: Schema.optional(Schema.String), // Optional cancel URL
  simulate: Schema.optional(Schema.Boolean), // Flag to bypass Saga/Checkout for testing
}) {}
