import type { Booking } from "@workspace/domain/booking";
import type {
	BookingNotFoundError,
	BookingPersistenceError,
	OptimisticLockingError,
} from "@workspace/domain/errors";
import type { BookingId, PnrCode } from "@workspace/domain/kernel";
import type { PassengerId } from "@workspace/domain/passenger";
import { Context, type Effect } from "effect";

export interface BookingRepositoryPort {
	/**
	 * Save a booking and return the persisted entity with updated version.
	 * Throws OptimisticLockingError if version mismatch occurs.
	 */
	save(
		booking: Booking,
	): Effect.Effect<Booking, OptimisticLockingError | BookingPersistenceError>;

	/**
	 * Find a booking by its ID.
	 */
	findById(id: BookingId): Effect.Effect<Booking, BookingNotFoundError>;

	/**
	 * Find a booking by its PNR code.
	 */
	findByPnr(pnr: PnrCode): Effect.Effect<Booking, BookingNotFoundError>;

	/**
	 * Find all bookings that expired before the given date.
	 */
	findExpired(before: Date): Effect.Effect<ReadonlyArray<Booking>>;

	/**
	 * Find all bookings for a specific passenger.
	 */
	findByPassengerId(
		passengerId: PassengerId,
	): Effect.Effect<ReadonlyArray<Booking>>;
}

export class BookingRepository extends Context.Tag("BookingRepository")<
	BookingRepository,
	BookingRepositoryPort
>() {}
