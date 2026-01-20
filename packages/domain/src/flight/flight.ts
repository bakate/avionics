import { Schema } from "effect";
import { Route, Schedule } from "../kernel.js";

export const FlightId = Schema.String.pipe(Schema.brand("FlightId"));
export type FlightId = typeof FlightId.Type;

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
