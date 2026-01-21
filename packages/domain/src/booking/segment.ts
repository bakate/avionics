import { Schema } from "effect";
import { FlightId } from "../flight/flight.js";
import { CabinClassSchema, Money } from "../kernel.js";

// --- Booking Segment Entity ---
export class BookingSegment extends Schema.Class<BookingSegment>(
	"BookingSegment",
)({
	flightId: FlightId,
	cabin: CabinClassSchema,
	price: Money,
}) {}
