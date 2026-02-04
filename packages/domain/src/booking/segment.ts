import { Schema } from "effect";
import { CabinClassSchema, FlightId, Money, SegmentId } from "../kernel.js";

// --- Booking Segment Entity ---
export class BookingSegment extends Schema.Class<BookingSegment>(
	"BookingSegment",
)({
	id: SegmentId,
	flightId: FlightId,
	cabin: CabinClassSchema,
	price: Money,
}) {}
