import * as Crypto from "node:crypto";
import { Booking } from "@workspace/domain/booking";
import { Coupon } from "@workspace/domain/coupon";
import {
	type BookingExpiredError,
	BookingNotFoundError,
	type BookingPersistenceError,
	type BookingStatusError,
	type FlightFullError,
	type FlightNotFoundError,
	type InvalidAmountError,
	type InventoryOvercapacityError,
	type InventoryPersistenceError,
	OptimisticLockingError,
} from "@workspace/domain/errors";
import {
	BookingId,
	CabinClassSchema,
	EmailSchema,
	GenderSchema,
	makeFlightId,
	PassengerTypeSchema,
	type PnrCode,
	PnrCodeSchema,
} from "@workspace/domain/kernel";
import { Passenger, PassengerId } from "@workspace/domain/passenger";
import { BookingSegment } from "@workspace/domain/segment";
import { Ticket, TicketNumber, TicketStatus } from "@workspace/domain/ticket";
import {
	type Cause,
	Context,
	Duration,
	Effect,
	Layer,
	Option as O,
	Ref,
	Schedule,
	Schema,
} from "effect";
import { NotificationGateway } from "../gateways/notification.gateway.js";
import { PaymentGateway } from "../gateways/payment.gateway.js";
import { UnitOfWork } from "../ports/unit-of-work.js";
import {
	BookingRepository,
	type BookingRepositoryPort,
} from "../repositories/booking.repository.js";
import {
	InventoryService,
	type InventoryServiceSignature,
} from "./inventory.service.js";

// ---------------------------------------------------------------------------
// Command Schema
// ---------------------------------------------------------------------------

export class BookFlightCommand extends Schema.Class<BookFlightCommand>(
	"BookFlightCommand",
)({
	flightId: Schema.String,
	cabinClass: CabinClassSchema,
	passenger: Schema.Struct({
		id: Schema.String,
		firstName: Schema.String,
		lastName: Schema.String,
		email: EmailSchema,
		dateOfBirth: Schema.Date,
		gender: GenderSchema,
		type: PassengerTypeSchema,
	}),
	seatNumber: Schema.Option(Schema.String),
	creditCardToken: Schema.String,
}) {}

// ---------------------------------------------------------------------------
// Service Interface
// ---------------------------------------------------------------------------

export interface BookingServiceImpl {
	bookFlight: (
		command: BookFlightCommand,
	) => Effect.Effect<
		Booking,
		| BookingNotFoundError
		| BookingStatusError
		| BookingExpiredError
		| FlightFullError
		| FlightNotFoundError
		| OptimisticLockingError
		| InvalidAmountError
		| InventoryPersistenceError
		| BookingPersistenceError
		| InventoryOvercapacityError
		| Cause.TimeoutException
		| { readonly _tag: "SqlError" }
	>;
	findAll: () => Effect.Effect<ReadonlyArray<Booking>, BookingPersistenceError>;
}

// ---------------------------------------------------------------------------
// Context.Tag — déclaration du service dans le contexte Effect
// ---------------------------------------------------------------------------

export class BookingService extends Context.Tag("BookingService")<
	BookingService,
	BookingServiceImpl
>() {
	// ------------------------------------------------------------------
	// Live Layer — Production implementation
	// Resolves dependencies explicitly via Effect.gen + yield*
	// ------------------------------------------------------------------
	// ------------------------------------------------------------------
	static readonly Live = Layer.effect(
		BookingService,
		Effect.gen(function* () {
			// Resolve dependencies from context
			const inventoryService = yield* InventoryService;
			const bookingRepo = yield* BookingRepository;
			const paymentGateway = yield* PaymentGateway;
			const notificationGateway = yield* NotificationGateway;
			const unitOfWork = yield* UnitOfWork;

			// Retry policy: exponential backoff, max 3 attempts
			const retryPolicy = Schedule.exponential(Duration.millis(100)).pipe(
				Schedule.compose(Schedule.recurs(3)),
			);

			return {
				bookFlight: (command: BookFlightCommand) =>
					Effect.gen(function* () {
						// 1. Hold seats and get price
						const holdResult = yield* inventoryService.holdSeats({
							flightId: makeFlightId(command.flightId),
							cabin: command.cabinClass,
							numberOfSeats: 1,
						});

						// 2. Prepare Booking (State HELD)
						// 2.1. Create Passenger
						const passenger = new Passenger({
							id: PassengerId.make(command.passenger.id),
							firstName: command.passenger.firstName,
							lastName: command.passenger.lastName,
							email: command.passenger.email,
							dateOfBirth: command.passenger.dateOfBirth,
							gender: command.passenger.gender,
							type: command.passenger.type,
						});

						// 2.2. Generate PNR
						const pnr = yield* generateUniquePnr(bookingRepo);

						// 2.3. Generate Booking ID (Manually brand)
						const bookingId = BookingId.make(Crypto.randomUUID());

						// 2.4. Create Booking Segment
						const segment = new BookingSegment({
							flightId: makeFlightId(command.flightId),
							cabin: command.cabinClass,
							price: holdResult.totalPrice,
						});

						// 2.5. Create Booking using factory method (emits BookingCreated event)
						const booking = Booking.create({
							id: bookingId,
							pnrCode: pnr,
							passengers: [passenger],
							segments: [segment],
							expiresAt: O.some(new Date(Date.now() + 30 * 60 * 1000)), // 30 min to pay
						});

						// 2.6. Save Booking with HELD status (within transaction)
						yield* unitOfWork.transaction(bookingRepo.save(booking));

						// 3. Process Payment with retry and timeout
						yield* paymentGateway
							.charge(holdResult.totalPrice, command.creditCardToken)
							.pipe(
								Effect.retry(retryPolicy),
								Effect.timeout(Duration.seconds(30)),
								// 3.1 If payment fails, release seats (compensation)
								Effect.catchAll((paymentError) =>
									Effect.gen(function* () {
										yield* Effect.logError(
											"Payment failed. Rolling back seats.",
											paymentError,
										);

										// A. Compensate: Release seats
										yield* inventoryService.releaseSeats({
											flightId: makeFlightId(command.flightId),
											cabin: command.cabinClass,
											numberOfSeats: 1,
										});

										// B. Cancel booking using aggregate method (emits BookingCancelled event)
										const cancelledBooking =
											yield* booking.cancel("Payment failed");

										// C. Save cancelled booking
										yield* unitOfWork.transaction(
											bookingRepo.save(cancelledBooking),
										);

										// Re-fail: Return the original error to the client
										return yield* Effect.fail(paymentError);
									}),
								),
							);

						// 4. Confirm Booking
						// We must re-fetch the booking to ensure we have the latest version
						// (Optimistic Locking) as payment might have taken some time.
						const confirmedBooking = yield* Effect.gen(function* () {
							const freshBooking = yield* bookingRepo.findById(booking.id).pipe(
								Effect.flatMap(
									O.match({
										onNone: () =>
											Effect.fail(
												new BookingNotFoundError({ searchkey: booking.id }),
											),
										onSome: (b) => Effect.succeed(b),
									}),
								),
							);

							// Confirm using aggregate method (emits BookingConfirmed event)
							const confirmed = yield* freshBooking.confirm();

							// Save confirmed booking within transaction
							return yield* unitOfWork.transaction(bookingRepo.save(confirmed));
						}).pipe(
							Effect.retry({
								times: 3,
								while: (error) => error instanceof OptimisticLockingError,
							}),
						);

						// 5. Issue Ticket
						const coupon = new Coupon({
							couponNumber: 1,
							flightId: makeFlightId(command.flightId),
							seatNumber: command.seatNumber,
							status: "OPEN",
						});

						const ticketNumber = yield* generateTicketNumber();

						const ticket = new Ticket({
							ticketNumber,
							pnrCode: pnr,
							status: TicketStatus.ISSUED,
							passengerId: passenger.id,
							passengerName: `${passenger.firstName} ${passenger.lastName}`,
							coupons: [coupon],
							issuedAt: new Date(),
						});

						// 6. Send notification with retry and timeout
						yield* notificationGateway
							.sendTicket(ticket, command.passenger.email)
							.pipe(
								Effect.retry(retryPolicy),
								Effect.timeout(Duration.seconds(10)),
								Effect.catchAll((err) =>
									Effect.logError("Failed to send email notification", err),
								),
							);

						return confirmedBooking;
					}),

				findAll: () => bookingRepo.findAll(),
			};
		}),
	);

	// ------------------------------------------------------------------
	// TestOverrides — Type to configure the Test layer
	// Each key is a Partial on the corresponding service.
	// Only pass what differs from the default behavior.
	// ------------------------------------------------------------------
	static readonly TestOverrides = {} as {
		inventoryService?: Partial<InventoryServiceSignature>;
		bookingRepo?: Partial<typeof BookingRepository.Service>;
		paymentGateway?: Partial<typeof PaymentGateway.Service>;
		notificationGateway?: Partial<typeof NotificationGateway.Service>;
		unitOfWork?: Partial<typeof UnitOfWork.Service>;
	};

	/**
	 * Test Layer — Factory that returns a complete Layer for tests.
	 *
	 * Default behaviors (without override):
	 *   - PaymentGateway.charge        → Effect.void (payment always OK)
	 *   - NotificationGateway.sendTicket → Effect.void (silent notification)
	 *   - UnitOfWork.transaction       → passthrough (no real transaction)
	 *   - BookingRepository.save       → returns the booking as-is
	 *   - BookingRepository.findByPnr  → BookingNotFoundError (no collision)
	 *   - BookingRepository.findById   → BookingNotFoundError
	 *   - InventoryService.*           → Delegated to InventoryService.Test (see its docs)
	 *
	 * Usage in a test:
	 *   const layer = BookingService.Test({ inventoryService: { holdSeats: ... } });
	 *   program.pipe(Effect.provide(layer))
	 */
	static readonly Test = (overrides: TestOverrides = {}) => {
		const InventoryServiceTest = InventoryService.Test(
			overrides.inventoryService,
		);

		const BookingRepoTest = Layer.effect(
			BookingRepository,
			Effect.gen(function* () {
				// Stateful in-memory store for saved bookings
				const store = yield* Ref.make(new Map<string, Booking>());

				return BookingRepository.of({
					save: (booking) =>
						Ref.modify<
							Map<string, Booking>,
							| { readonly _tag: "Success"; readonly saved: Booking }
							| {
									readonly _tag: "Conflict";
									readonly error: OptimisticLockingError;
							  }
						>(store, (map) => {
							const current = map.get(booking.id);

							if (current && current.version !== booking.version) {
								return [
									{
										_tag: "Conflict",
										error: new OptimisticLockingError({
											entityType: "Booking",
											id: booking.id,
											expectedVersion: booking.version,
											actualVersion: current.version,
										}),
									} as const,
									map,
								];
							}

							const nextVersion = current
								? current.version + 1
								: booking.version;
							const saved = new Booking({
								...booking,
								version: nextVersion,
							});

							const newMap = new Map(map);
							newMap.set(booking.id, saved);
							return [{ _tag: "Success", saved } as const, newMap];
						}).pipe(
							Effect.flatMap((result) =>
								result._tag === "Conflict"
									? Effect.fail(result.error)
									: Effect.succeed(result.saved),
							),
						),
					findById: (id) =>
						Ref.get(store).pipe(
							Effect.map((map) => {
								const booking = map.get(id);
								return booking ? O.some(booking) : O.none();
							}),
						),
					findByPnr: () => Effect.succeed(O.none()),
					findExpired: () => Effect.succeed([]),
					findByPassengerId: () => Effect.succeed([]),
					findAll: () =>
						Ref.get(store).pipe(Effect.map((map) => Array.from(map.values()))),
					...overrides.bookingRepo,
				});
			}),
		);

		const PaymentGatewayTest = Layer.succeed(
			PaymentGateway,
			PaymentGateway.of({
				charge: () => Effect.void,
				...overrides.paymentGateway,
			}),
		);

		const NotificationGatewayTest = Layer.succeed(
			NotificationGateway,
			NotificationGateway.of({
				sendTicket: () => Effect.void,
				...overrides.notificationGateway,
			}),
		);

		const UnitOfWorkTest = Layer.succeed(
			UnitOfWork,
			UnitOfWork.of({
				transaction: (effect) => effect,
				...overrides.unitOfWork,
			}),
		);

		// Composition: BookingService.Live on top, mocks below.
		// Live will yield* each dep → it will find them in the layers below.
		return BookingService.Live.pipe(
			Layer.provide(
				InventoryServiceTest.pipe(
					Layer.merge(BookingRepoTest),
					Layer.merge(PaymentGatewayTest),
					Layer.merge(NotificationGatewayTest),
					Layer.merge(UnitOfWorkTest),
				),
			),
		);
	};
}

// Type helper for test overrides
export type TestOverrides = {
	inventoryService?: Partial<InventoryServiceSignature>;
	bookingRepo?: Partial<typeof BookingRepository.Service>;
	paymentGateway?: Partial<typeof PaymentGateway.Service>;
	notificationGateway?: Partial<typeof NotificationGateway.Service>;
	unitOfWork?: Partial<typeof UnitOfWork.Service>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const generateUniquePnr = (
	bookingRepo: BookingRepositoryPort,
): Effect.Effect<PnrCode> => {
	const generate = Effect.gen(function* () {
		const candidate = generatePnrCandidate();
		const pnr = Schema.decodeSync(PnrCodeSchema)(candidate);

		return yield* bookingRepo.findByPnr(pnr).pipe(
			Effect.flatMap(
				O.match({
					onNone: () => Effect.succeed(pnr), // PNR is unique
					onSome: () => Effect.fail(new Error("Collision")), // PNR already exists
				}),
			),
		);
	});

	return generate.pipe(
		Effect.retry({ times: 5 }),
		Effect.catchAll(() =>
			Effect.die(new Error("Failed to generate unique PNR after max retries")),
		),
	);
};

const generatePnrCandidate = (): string => {
	const randomBytes = Crypto.randomBytes(4);
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let candidate = "";
	for (const byte of randomBytes) {
		candidate += charset[byte % charset.length];
	}
	if (candidate.length > 6) candidate = candidate.slice(0, 6);
	while (candidate.length < 6) {
		const byte = Crypto.randomBytes(1)[0];
		if (byte === undefined) continue;
		candidate += charset[byte % charset.length];
	}
	return candidate;
};

const generateTicketNumber = (): Effect.Effect<TicketNumber> => {
	return Effect.sync(() => {
		const prefix = "176";
		let serial = "";
		const bytes = Crypto.randomBytes(10);
		for (const byte of bytes) {
			serial += (byte % 10).toString();
		}
		return TicketNumber.make(prefix + serial);
	});
};
