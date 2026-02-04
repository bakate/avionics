import type { Booking } from "@workspace/domain/booking";
import type {
	BookingNotFoundError,
	BookingPersistenceError,
	OptimisticLockingError,
} from "@workspace/domain/errors";
import type { BookingId, PnrCode } from "@workspace/domain/kernel";
import type { PassengerId } from "@workspace/domain/passenger";
import { Context, type Effect, type Option } from "effect";

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
	 * Returns Option.none() if not found.
	 */
	findById(
		id: BookingId,
	): Effect.Effect<Option.Option<Booking>, BookingPersistenceError>;

	/**
	 * Find a booking by its PNR code.
	 * Returns Option.none() if not found.
	 */
	findByPnr(
		pnr: PnrCode,
	): Effect.Effect<Option.Option<Booking>, BookingPersistenceError>;

	/**
	 * Find all bookings that expired before the given date.
	 */
	findExpired(before: Date): Effect.Effect<ReadonlyArray<Booking>>;

	findByPassengerId(
		passengerId: PassengerId,
	): Effect.Effect<ReadonlyArray<Booking>>;

	/**
	 * Find all bookings.
	 */
	findAll(): Effect.Effect<ReadonlyArray<Booking>, BookingPersistenceError>;
}

export class BookingRepository extends Context.Tag("BookingRepository")<
	BookingRepository,
	BookingRepositoryPort
>() {}
