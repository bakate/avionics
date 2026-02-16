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
  flightId: Schema.String,
  cabinClass: CabinClassSchema,
  passenger: Schema.Struct({
    id: Schema.String,
    firstName: Schema.String,
    lastName: Schema.String,
    email: EmailSchema,
    dateOfBirth: Schema.Date,
    gender: GenderSchema,
    type: PassengerTypeSchema,
  }),
  seatNumber: Schema.OptionFromNullOr(Schema.String).pipe(Schema.optional),
  successUrl: Schema.String, // URL for payment redirect success
  cancelUrl: Schema.optional(Schema.String), // Optional cancel URL
}) {}
