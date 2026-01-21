import type { FlightNotFoundError } from "@workspace/domain/errors";
import type { FlightId } from "@workspace/domain/flight";
import type { FlightInventory } from "@workspace/domain/inventory";
import { Context, type Effect } from "effect";

interface InventoryRepositoryPort {
	save(inventory: FlightInventory): Effect.Effect<void>;
	getByFlightId(
		id: FlightId,
	): Effect.Effect<FlightInventory, FlightNotFoundError>;
}
export class InventoryRepository extends Context.Tag("InventoryRepository")<
	InventoryRepository,
	InventoryRepositoryPort
>() {}
