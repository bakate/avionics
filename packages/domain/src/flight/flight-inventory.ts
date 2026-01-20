import { Schema } from "effect";
import { FlightId } from "../flight/flight.js";

const SeatCount = Schema.Number.pipe(Schema.int(), Schema.nonNegative());

export class FlightInventory extends Schema.Class<FlightInventory>(
	"FlightInventory",
)({
	flightId: FlightId, // Link to Flight
	availability: Schema.Struct({
		economy: SeatCount,
		business: SeatCount,
		first: SeatCount,
	}),
	version: Schema.Number.pipe(Schema.int(), Schema.nonNegative()), // Optimistic Concurrency
}) {}
