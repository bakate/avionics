import type {
	FlightNotFoundError,
	InventoryPersistenceError,
	OptimisticLockingError,
} from "@workspace/domain/errors";
import type { FlightInventory } from "@workspace/domain/inventory";
import type { FlightId } from "@workspace/domain/kernel";
import { Context, type Effect } from "effect";

export interface InventoryRepositoryPort {
	/**
	 * Save inventory and return the persisted entity with updated version.
	 * Throws OptimisticLockingError if version mismatch occurs.
	 */
	save(
		inventory: FlightInventory,
	): Effect.Effect<
		FlightInventory,
		OptimisticLockingError | InventoryPersistenceError
	>;

	/**
	 * Get inventory by flight ID.
	 */
	getByFlightId(
		id: FlightId,
	): Effect.Effect<
		FlightInventory,
		FlightNotFoundError | InventoryPersistenceError
	>;

	/**
	 * Find all flights with available seats in a specific cabin.
	 */
	findAvailableFlights(
		cabin: string,
		minSeats: number,
	): Effect.Effect<ReadonlyArray<FlightInventory>, InventoryPersistenceError>;
}

export class InventoryRepository extends Context.Tag("InventoryRepository")<
	InventoryRepository,
	InventoryRepositoryPort
>() {}
