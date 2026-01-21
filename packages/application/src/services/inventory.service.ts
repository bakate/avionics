import type {
	FlightFullError,
	FlightNotFoundError,
	InvalidAmountError,
	InventoryOvercapacityError,
	OptimisticLockingError,
} from "@workspace/domain/errors";

import type { FlightId } from "@workspace/domain/flight";
import type { FlightInventory } from "@workspace/domain/inventory";
import type { CabinClass, Money } from "@workspace/domain/kernel";
import { Effect } from "effect";
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
		{ inventory: FlightInventory; price: Money },
		| FlightFullError
		| FlightNotFoundError
		| OptimisticLockingError
		| InvalidAmountError
	>;
	releaseSeats: (
		params: HoldSeatsInput,
	) => Effect.Effect<
		FlightInventory,
		| FlightNotFoundError
		| OptimisticLockingError
		| InvalidAmountError
		| InventoryOvercapacityError
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
						// optimistic locking
						yield* repo.save(nextInventory);
						const totalPrice = unitPrice.multiply(numberOfSeats);

						return { inventory: nextInventory, price: totalPrice };
					}),

				releaseSeats: ({ flightId, cabin, numberOfSeats }: HoldSeatsInput) =>
					Effect.gen(function* () {
						const inventory = yield* repo.getByFlightId(flightId);

						// Domain Logic moved to Entity (Rich Model)
						const nextInventory = yield* inventory.releaseSeats(
							cabin,
							numberOfSeats,
						);
						// optimistic locking
						yield* repo.save(nextInventory);
						return nextInventory;
					}),

				getAvailability: (flightId: FlightId) => repo.getByFlightId(flightId),
			};
		}),
	},
) {}
