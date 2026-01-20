import { Data } from "effect";

// --- Kernel / Primitives Errors ---

export class CurrencyMismatchError extends Data.TaggedError(
	"CurrencyMismatchError",
)<{
	readonly expected: string;
	readonly actual: string;
}> {}

export class OptimisticLockingError extends Data.TaggedError(
	"OptimisticLockingError",
)<{
	readonly entityType: string;
	readonly id: string;
	readonly expectedVersion: number;
	readonly actualVersion: number;
}> {}

// --- Inventory Errors ---

export class FlightFullError extends Data.TaggedError("FlightFullError")<{
	readonly flightId: string;
	readonly cabin: string;
	readonly requested: number;
	readonly available: number;
}> {}

export class FlightNotFoundError extends Data.TaggedError(
	"FlightNotFoundError",
)<{
	readonly flightId: string;
}> {}

// --- Booking Errors ---

export class BookingNotFoundError extends Data.TaggedError(
	"BookingNotFoundError",
)<{
	readonly searchkey: string;
}> {}

export class BookingExpiredError extends Data.TaggedError(
	"BookingExpiredError",
)<{
	readonly pnrCode: string;
	readonly expiresAt: Date;
}> {}

export class BookingStatusError extends Data.TaggedError("BookingStatusError")<{
	readonly pnrCode: string;
	readonly status: string;
	readonly expected: string;
}> {}

// --- Ticketing Errors ---

export class TicketAlreadyIssuedError extends Data.TaggedError(
	"TicketAlreadyIssuedError",
)<{
	readonly pnrCode: string;
}> {}
