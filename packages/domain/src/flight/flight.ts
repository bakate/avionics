import { Schema } from "effect";
import { FlightId, Route, Schedule } from "../kernel.js";

// flight number (e.g., "AF1234")
export const FlightNumber = Schema.String.pipe(
	Schema.pattern(/^[A-Z]{2,3}\d{1,4}$/),
	Schema.brand("FlightNumber"),
);
export type FlightNumber = typeof FlightNumber.Type;

export class Flight extends Schema.Class<Flight>("Flight")({
	id: FlightId,
	flightNumber: FlightNumber,
	route: Route.schema,
	schedule: Schedule.schema,
}) {}
