import { Effect, Schema } from "effect";
import {
	FlightFullError,
	InvalidAmountError,
	InventoryOvercapacityError,
} from "../errors.js";
import { type EventId, SeatsHeld, SeatsReleased } from "../events.js";
import { type CabinClass, FlightId, Money } from "../kernel.js";

export class SeatBucket extends Schema.Class<SeatBucket>("SeatBucket")({
	available: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
	capacity: Schema.Number.pipe(Schema.int(), Schema.positive()),
	price: Money,
}) {}

export class FlightInventory extends Schema.Class<FlightInventory>(
	"FlightInventory",
)({
	flightId: FlightId, // Link to Flight
	availability: Schema.Struct({
		economy: SeatBucket,
		business: SeatBucket,
		first: SeatBucket,
	}),
	version: Schema.Number.pipe(Schema.int(), Schema.nonNegative()), // Optimistic Concurrency
	domainEvents: Schema.Array(Schema.Unknown).pipe(
		Schema.annotations({
			description: "Domain events raised by this aggregate",
		}),
	),
}) {
	holdSeats(
		cabin: CabinClass,
		amount: number,
	): Effect.Effect<
		readonly [FlightInventory, Money],
		FlightFullError | InvalidAmountError
	> {
		return Effect.gen(this, function* () {
			if (amount <= 0 || !Number.isInteger(amount)) {
				return yield* Effect.fail(new InvalidAmountError({ amount }));
			}
			// 1. Identify the bucket
			const checkKey = cabin.toLowerCase() as keyof typeof this.availability;
			const bucket = this.availability[checkKey];

			// 2. Check if there are enough seats
			if (bucket.available < amount) {
				return yield* Effect.fail(
					new FlightFullError({
						flightId: this.flightId,
						cabin,
						requested: amount,
						available: bucket.available,
					}),
				);
			}

			// 3. Create domain event
			const event = new SeatsHeld({
				eventId: `evt-${crypto.randomUUID()}` as EventId,
				occurredAt: new Date(),
				aggregateId: this.flightId,
				aggregateType: "FlightInventory",
				flightId: this.flightId,
				cabin,
				quantity: amount,
			});

			// 4. New Inventory State
			const nextBucket = new SeatBucket({
				...bucket,
				available: bucket.available - amount,
				// (Optional) : We could apply the Management Yield, for instance (e.g. +10% if "available" is less than 50)
				// for now, we will keep it simple
			});
			const nextInventory = new FlightInventory({
				...this,
				availability: {
					...this.availability,
					[checkKey]: nextBucket,
				},
				version: this.version + 1,
				domainEvents: [...this.domainEvents, event],
			});
			return [nextInventory, bucket.price] as const;
		});
	}

	releaseSeats(
		cabin: CabinClass,
		amount: number,
	): Effect.Effect<
		FlightInventory,
		InvalidAmountError | InventoryOvercapacityError
	> {
		return Effect.gen(this, function* () {
			if (amount <= 0 || !Number.isInteger(amount)) {
				return yield* Effect.fail(new InvalidAmountError({ amount }));
			}
			// 1. Identify the bucket
			const checkKey = cabin.toLowerCase() as keyof typeof this.availability;
			const bucket = this.availability[checkKey];

			// 2. Check Capacity
			if (bucket.available + amount > bucket.capacity) {
				return yield* Effect.fail(
					new InventoryOvercapacityError({
						flightId: this.flightId,
						cabin,
						requested: amount,
						available: bucket.available,
						capacity: bucket.capacity,
					}),
				);
			}

			// 3. Create domain event
			const event = new SeatsReleased({
				eventId: `evt-${crypto.randomUUID()}` as EventId,
				occurredAt: new Date(),
				aggregateId: this.flightId,
				aggregateType: "FlightInventory",
				flightId: this.flightId,
				cabin,
				quantity: amount,
			});

			// 4. New Inventory State
			const nextBucket = new SeatBucket({
				...bucket,
				available: bucket.available + amount,
			});
			const nextInventory = new FlightInventory({
				...this,
				availability: {
					...this.availability,
					[checkKey]: nextBucket,
				},
				version: this.version + 1,
				domainEvents: [...this.domainEvents, event],
			});
			return nextInventory;
		});
	}

	clearEvents(): FlightInventory {
		return new FlightInventory({
			...this,
			domainEvents: [],
		});
	}
}
