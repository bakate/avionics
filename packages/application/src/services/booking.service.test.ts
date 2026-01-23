import { faker } from "@faker-js/faker";
import {
	BookingNotFoundError,
	FlightFullError,
} from "@workspace/domain/errors";
import { FlightInventory, SeatBucket } from "@workspace/domain/inventory";
import {
	type Email,
	Money,
	makeFlightId,
	type PassengerType,
} from "@workspace/domain/kernel";
import { Effect, Layer, Option } from "effect";
import { describe, expect, it } from "vitest";
import { NotificationGateway } from "../gateways/notification.gateway.js";
import { PaymentGateway } from "../gateways/payment.gateway.js";
import { UnitOfWork } from "../ports/unit-of-work.js";
import { BookingRepository } from "../repositories/booking.repository.js";
import { BookFlightCommand, BookingService } from "./booking.service.js";
import { InventoryService } from "./inventory.service.js";

const makePassenger = () => ({
	id: faker.string.uuid(),
	firstName: faker.person.firstName(),
	lastName: faker.person.lastName(),
	email: faker.internet.email() as Email,
	dateOfBirth: faker.date.birthdate(),
	gender: "MALE" as const,
	type: "ADULT" as PassengerType,
});

const makeInventory = (
	flightId: string,
	overrides?: Partial<FlightInventory["availability"]>,
) =>
	new FlightInventory({
		flightId: makeFlightId(flightId),
		availability: {
			economy: new SeatBucket({
				available: 10,
				capacity: 100,
				price: Money.of(500, "EUR"),
			}),
			business: new SeatBucket({
				available: 5,
				capacity: 50,
				price: Money.of(1000, "USD"),
			}),
			first: new SeatBucket({
				available: 2,
				capacity: 20,
				price: Money.of(2000, "USD"),
			}),
			...overrides,
		},
		version: 1,
		domainEvents: [],
	});

const makeTestLayer = (mocks: {
	inventoryService?: Partial<typeof InventoryService.Service>;
	bookingRepo?: Partial<typeof BookingRepository.Service>;
	paymentGateway?: Partial<typeof PaymentGateway.Service>;
	notificationGateway?: Partial<typeof NotificationGateway.Service>;
	unitOfWork?: Partial<typeof UnitOfWork.Service>;
}) => {
	const InventoryServiceTest = Layer.succeed(
		InventoryService,
		InventoryService.of({
			holdSeats: () => Effect.die("Not implemented"),
			getAvailability: () => Effect.die("Not implemented"),
			releaseSeats: () => Effect.die("Not implemented"),
			...mocks.inventoryService,
		}),
	);

	const BookingRepoTest = Layer.succeed(
		BookingRepository,
		BookingRepository.of({
			save: (booking) => Effect.succeed(booking), // Return the booking
			findById: (id) =>
				Effect.fail(new BookingNotFoundError({ searchkey: id })),
			findByPnr: () =>
				Effect.fail(new BookingNotFoundError({ searchkey: "mock" })),
			findExpired: () => Effect.succeed([]),
			findByPassengerId: () => Effect.succeed([]),
			...mocks.bookingRepo,
		}),
	);

	const PaymentGatewayTest = Layer.succeed(
		PaymentGateway,
		PaymentGateway.of({
			charge: () => Effect.void,
			...mocks.paymentGateway,
		}),
	);

	const NotificationGatewayTest = Layer.succeed(
		NotificationGateway,
		NotificationGateway.of({
			sendTicket: () => Effect.void,
			...mocks.notificationGateway,
		}),
	);

	const UnitOfWorkTest = Layer.succeed(
		UnitOfWork,
		UnitOfWork.of({
			transaction: (effect) => effect, // Pass-through for tests
			...mocks.unitOfWork,
		}),
	);

	return InventoryServiceTest.pipe(
		Layer.merge(BookingRepoTest),
		Layer.merge(PaymentGatewayTest),
		Layer.merge(NotificationGatewayTest),
		Layer.merge(UnitOfWorkTest),
	);
};

describe("BookingService", () => {
	it("should successfully book a flight when inventory is available", async () => {
		const flightId = faker.string.alphanumeric(6);
		const inventory = makeInventory(flightId);

		const TestLayer = BookingService.Default.pipe(
			Layer.provide(
				makeTestLayer({
					inventoryService: {
						holdSeats: () =>
							Effect.succeed({
								inventory,
								totalPrice: Money.of(500, "EUR"),
								unitPrice: Money.of(500, "EUR"),
								seatsHeld: 1,
								holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
							}),
						getAvailability: () => Effect.succeed(inventory),
						releaseSeats: () =>
							Effect.succeed({
								inventory,
								seatsReleased: 1,
							}),
					},
					bookingRepo: {
						save: (booking) => Effect.succeed(booking),
					},
					notificationGateway: {
						sendTicket: (ticket) =>
							Effect.sync(() => {
								expect(ticket.coupons[0].flightId).toBe(flightId);
							}),
					},
				}),
			),
		);

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

		const TestLayer = BookingService.Default.pipe(
			Layer.provide(
				makeTestLayer({
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
				}),
			),
		);

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
		const inventory = makeInventory(flightId);
		let pnrCheckCount = 0;

		const TestLayer = BookingService.Default.pipe(
			Layer.provide(
				makeTestLayer({
					inventoryService: {
						holdSeats: () =>
							Effect.succeed({
								inventory,
								totalPrice: Money.of(500, "EUR"),
								unitPrice: Money.of(500, "EUR"),
								seatsHeld: 1,
								holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
							}),
						getAvailability: () => Effect.succeed(inventory),
						releaseSeats: () =>
							Effect.succeed({
								inventory,
								seatsReleased: 1,
							}),
					},
					bookingRepo: {
						save: (booking) => Effect.succeed(booking),
						findByPnr: () => {
							pnrCheckCount++;
							if (pnrCheckCount === 1) {
								// First time: Find collision
								return Effect.succeed(
									{} as unknown as import("@workspace/domain/booking").Booking, // Mock booking object
								);
							}
							// Second time: Not found (success)
							return Effect.fail(
								new BookingNotFoundError({ searchkey: "mock" }),
							);
						},
					},
				}),
			),
		);

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
});
