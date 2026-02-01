import { faker } from "@faker-js/faker";
import type { Booking } from "@workspace/domain/booking";
import {
	BookingNotFoundError,
	FlightFullError,
	FlightNotFoundError,
	OptimisticLockingError,
} from "@workspace/domain/errors";
import { FlightInventory, SeatBucket } from "@workspace/domain/inventory";
import {
	type Email,
	Money,
	makeFlightId,
	type PassengerType,
} from "@workspace/domain/kernel";
import { Effect, Layer, Option, Ref } from "effect";
import { describe, expect, it } from "vitest";
import { NotificationGateway } from "../gateways/notification.gateway.js";
import { PaymentGateway } from "../gateways/payment.gateway.js";
import { UnitOfWork } from "../ports/unit-of-work.js";
import { BookingRepository } from "../repositories/booking.repository.js";
import { InventoryRepository } from "../repositories/inventory.repository.js";
import { BookFlightCommand, BookingService } from "./booking.service.js";
import { InventoryService } from "./inventory.service.js";

// --- Helpers de Test ---

const makePassenger = () => ({
	id: faker.string.uuid(),
	firstName: faker.person.firstName(),
	lastName: faker.person.lastName(),
	email: faker.internet.email() as Email,
	dateOfBirth: faker.date.birthdate(),
	gender: "MALE" as const,
	type: "ADULT" as PassengerType,
});

// --- Fake In-Memory Stateful Repositories (for concurrency tests) ---

const makeFakeInventoryRepo = (initialState: FlightInventory[]) => {
	return Effect.gen(function* () {
		const store = new Map(initialState.map((i) => [i.flightId, i]));
		const ref = yield* Ref.make(store);

		return InventoryRepository.of({
			getByFlightId: (id) =>
				Ref.get(ref).pipe(
					Effect.flatMap((map) => {
						const item = map.get(id);
						return item
							? Effect.succeed(item)
							: Effect.fail(new FlightNotFoundError({ flightId: id }));
					}),
				),
			save: (inventory) =>
				Ref.modify(ref, (map) => {
					const current = map.get(inventory.flightId);
					if (current && current.version !== inventory.version - 1) {
						throw new OptimisticLockingError({
							entityType: "FlightInventory",
							id: inventory.flightId,
							expectedVersion: inventory.version - 1,
							actualVersion: current.version,
						});
					}
					const newMap = new Map(map);
					newMap.set(inventory.flightId, inventory);
					return [inventory, newMap];
				}).pipe(
					Effect.catchAllDefect((e) => {
						if (e instanceof OptimisticLockingError) return Effect.fail(e);
						return Effect.die(e);
					}),
				),
			findAvailableFlights: () => Effect.succeed([]),
		});
	});
};

const makeFakeBookingRepo = () => {
	return Effect.gen(function* () {
		const ref = yield* Ref.make(new Map<string, unknown>());

		return BookingRepository.of({
			save: (booking) =>
				Ref.update(ref, (map) => map.set(booking.id, booking)).pipe(
					Effect.map(() => booking),
				),
			findById: (id) =>
				Ref.get(ref).pipe(
					Effect.flatMap((map) => {
						const booking = map.get(id);
						return booking
							? Effect.succeed(
									booking as import("@workspace/domain/booking").Booking,
								)
							: Effect.fail(new BookingNotFoundError({ searchkey: id }));
					}),
				),
			findByPnr: () =>
				Effect.fail(new BookingNotFoundError({ searchkey: "mock" })),
			findExpired: () => Effect.succeed([]),
			findByPassengerId: () => Effect.succeed([]),
		});
	});
};

describe("BookingService", () => {
	it("should successfully book a flight when inventory is available", async () => {
		const flightId = faker.string.alphanumeric(6);

		const TestLayer = BookingService.Test({
			notificationGateway: {
				sendTicket: (ticket) =>
					Effect.sync(() => {
						expect(ticket.coupons[0].flightId).toBe(flightId);
					}),
			},
		});

		const command = new BookFlightCommand({
			flightId,
			cabinClass: "ECONOMY",
			passenger: makePassenger(),
			seatNumber: Option.some("12A"),
			creditCardToken: "tok_visa",
		});

		const program = Effect.gen(function* () {
			const service = yield* BookingService;
			return yield* service.bookFlight(command);
		}).pipe(Effect.provide(TestLayer));

		const result = await Effect.runPromise(program);

		expect(result.status).toBe("Confirmed");
	});

	it("should fail when no seats available", async () => {
		const flightId = faker.string.alphanumeric(6);

		const TestLayer = BookingService.Test({
			inventoryService: {
				holdSeats: (params) =>
					Effect.fail(
						new FlightFullError({
							flightId: params.flightId,
							cabin: params.cabin,
							requested: params.numberOfSeats,
							available: 0,
						}),
					),
			},
		});

		const command = new BookFlightCommand({
			flightId,
			cabinClass: "ECONOMY",
			passenger: makePassenger(),
			seatNumber: Option.some("12A"),
			creditCardToken: "tok_visa",
		});

		const program = Effect.gen(function* () {
			const service = yield* BookingService;
			return yield* service.bookFlight(command);
		}).pipe(Effect.provide(TestLayer));

		const exit = await Effect.runPromiseExit(program);
		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure") {
			expect(JSON.stringify(exit.cause)).toContain("FlightFullError");
		}
	});

	it("should retry PNR generation on collision", async () => {
		const flightId = faker.string.alphanumeric(6);
		let pnrCheckCount = 0;

		const TestLayer = BookingService.Test({
			bookingRepo: {
				findByPnr: () => {
					pnrCheckCount++;
					if (pnrCheckCount === 1) {
						// First time: Find collision
						return Effect.succeed({} as unknown as Booking);
					}
					// Second time: Not found (success)
					return Effect.fail(new BookingNotFoundError({ searchkey: "mock" }));
				},
			},
		});

		const command = new BookFlightCommand({
			flightId,
			cabinClass: "ECONOMY",
			passenger: makePassenger(),
			seatNumber: Option.some("12A"),
			creditCardToken: "tok_visa",
		});

		const program = Effect.gen(function* () {
			const service = yield* BookingService;
			return yield* service.bookFlight(command);
		}).pipe(Effect.provide(TestLayer));

		const result = await Effect.runPromise(program);

		expect(result.status).toBe("Confirmed");
		expect(pnrCheckCount).toBe(2);
	});

	it("should prevent overbooking when 10 users compete for 1 seat (Strict Concurrency)", async () => {
		const flightId = "FL-CONCURRENCY-1";

		// Create inventory with 1 available seat in economy (capacity 100 for validation)
		const initialInventory = new FlightInventory({
			flightId: makeFlightId(flightId),
			availability: {
				economy: new SeatBucket({
					available: 1,
					capacity: 100,
					price: Money.of(100, "EUR"),
				}),
				business: new SeatBucket({
					available: 0,
					capacity: 10,
					price: Money.of(0, "EUR"),
				}),
				first: new SeatBucket({
					available: 0,
					capacity: 10,
					price: Money.of(0, "EUR"),
				}),
			},
			version: 1,
			domainEvents: [],
		});

		const CONCURRENT_USERS = 10;

		const program = Effect.gen(function* () {
			const inventoryRepo = yield* makeFakeInventoryRepo([initialInventory]);
			const bookingRepo = yield* makeFakeBookingRepo();
			const paymentGateway = PaymentGateway.of({ charge: () => Effect.void });
			const notificationGateway = NotificationGateway.of({
				sendTicket: () => Effect.void,
			});
			const unitOfWork = UnitOfWork.of({ transaction: (eff) => eff });

			const BookingServiceLive = BookingService.Live.pipe(
				Layer.provide(InventoryService.Live),
				Layer.provide(Layer.succeed(InventoryRepository, inventoryRepo)),
				Layer.provide(Layer.succeed(BookingRepository, bookingRepo)),
				Layer.provide(Layer.succeed(PaymentGateway, paymentGateway)),
				Layer.provide(Layer.succeed(NotificationGateway, notificationGateway)),
				Layer.provide(Layer.succeed(UnitOfWork, unitOfWork)),
			);

			const bookingService = yield* BookingService.pipe(
				Effect.provide(BookingServiceLive),
			);

			const commands = Array.from(
				{ length: CONCURRENT_USERS },
				(_, i) =>
					new BookFlightCommand({
						flightId,
						cabinClass: "ECONOMY",
						passenger: makePassenger(),
						seatNumber: Option.some(`1${i}A`),
						creditCardToken: "tok_visa",
					}),
			);

			const results = yield* Effect.all(
				commands.map((cmd) =>
					bookingService.bookFlight(cmd).pipe(
						Effect.map(() => "SUCCESS" as const),
						Effect.catchTags({
							FlightFullError: () => Effect.succeed("FULL" as const),
							OptimisticLockingError: () => Effect.succeed("LOCKED" as const),
						}),
						Effect.catchAll((e) => Effect.fail(e)),
					),
				),
				{ concurrency: "unbounded" },
			);

			const successes = results.filter((r) => r === "SUCCESS").length;
			return {
				successes,
				finalInventory: yield* inventoryRepo.getByFlightId(
					makeFlightId(flightId),
				),
			};
		});

		const report = await Effect.runPromise(program);
		expect(report.successes).toBe(1);
		expect(report.finalInventory.availability.economy.available).toBe(0);
	});
});
