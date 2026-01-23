import { Schema } from "effect";
import { CabinClassSchema, FlightId, Money } from "../kernel.js";

// --- Booking Segment Entity ---
export class BookingSegment extends Schema.Class<BookingSegment>(
	"BookingSegment",
)({
	flightId: FlightId,
	cabin: CabinClassSchema,
	price: Money,
}) {}
