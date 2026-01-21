import { Schema } from "effect";
import { FlightId } from "../flight/flight.js";

export class Coupon extends Schema.Class<Coupon>("Coupon")({
	couponNumber: Schema.Number.pipe(Schema.int(), Schema.positive()),
	flightId: FlightId,
	seatNumber: Schema.OptionFromNullOr(Schema.String),
	status: Schema.optionalWith(
		Schema.Literal("OPEN", "USED", "VOID", "EXCHANGED", "CHECKED_IN"),
		{
			default: () => "OPEN",
		},
	),
}) {}
