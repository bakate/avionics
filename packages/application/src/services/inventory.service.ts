import type {
	FlightFullError,
	FlightNotFoundError,
	InvalidAmountError,
	InventoryOvercapacityError,
	InventoryPersistenceError,
	OptimisticLockingError,
} from "@workspace/domain/errors";
import type { FlightInventory } from "@workspace/domain/inventory";
import type { CabinClass, FlightId } from "@workspace/domain/kernel";
import { Effect } from "effect";
import { HoldSeatsResult, ReleaseSeatsResult } from "../models/results.js";
import { InventoryRepository } from "../repositories/inventory.repository.js";

export type HoldSeatsInput = {
	flightId: FlightId;
	cabin: CabinClass;
	numberOfSeats: number;
};

export interface InventoryServiceSignature {
	holdSeats: (
		params: HoldSeatsInput,
	) => Effect.Effect<
		HoldSeatsResult,
		| FlightFullError
		| FlightNotFoundError
		| OptimisticLockingError
		| InvalidAmountError
		| InventoryPersistenceError
	>;
	releaseSeats: (
		params: HoldSeatsInput,
	) => Effect.Effect<
		ReleaseSeatsResult,
		| FlightNotFoundError
		| OptimisticLockingError
		| InvalidAmountError
		| InventoryOvercapacityError
		| InventoryPersistenceError
	>;
	getAvailability: (
		flightId: FlightId,
	) => Effect.Effect<FlightInventory, FlightNotFoundError>;
}

export class InventoryService extends Effect.Service<InventoryServiceSignature>()(
	"InventoryService",
	{
		effect: Effect.gen(function* () {
			const repo = yield* InventoryRepository;

			return {
				holdSeats: ({ flightId, cabin, numberOfSeats }: HoldSeatsInput) =>
					Effect.gen(function* () {
						const inventory = yield* repo.getByFlightId(flightId);

						// Domain Logic moved to Entity (Rich Model)
						const [nextInventory, unitPrice] = yield* inventory.holdSeats(
							cabin,
							numberOfSeats,
						);

						// Save with optimistic locking - returns updated entity
						const savedInventory = yield* repo.save(nextInventory);
						const totalPrice = unitPrice.multiply(numberOfSeats);

						return new HoldSeatsResult({
							inventory: savedInventory,
							totalPrice,
							unitPrice,
							seatsHeld: numberOfSeats,
							holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
						});
					}),

				releaseSeats: ({ flightId, cabin, numberOfSeats }: HoldSeatsInput) =>
					Effect.gen(function* () {
						const inventory = yield* repo.getByFlightId(flightId);

						// Domain Logic moved to Entity (Rich Model)
						const nextInventory = yield* inventory.releaseSeats(
							cabin,
							numberOfSeats,
						);

						// Save with optimistic locking - returns updated entity
						const savedInventory = yield* repo.save(nextInventory);

						return new ReleaseSeatsResult({
							inventory: savedInventory,
							seatsReleased: numberOfSeats,
						});
					}),

				getAvailability: (flightId: FlightId) => repo.getByFlightId(flightId),
			};
		}),
	},
) {}
