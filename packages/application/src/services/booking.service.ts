import * as Crypto from "node:crypto";
import { Booking } from "@workspace/domain/booking";
import { Coupon } from "@workspace/domain/coupon";
import {
	type BookingId,
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
import { Duration, Effect, Option as O, Schedule, Schema } from "effect";
import { NotificationGateway } from "../gateways/notification.gateway.js";
import { PaymentGateway } from "../gateways/payment.gateway.js";
import { UnitOfWork } from "../ports/unit-of-work.js";
import {
	BookingRepository,
	type BookingRepositoryPort,
} from "../repositories/booking.repository.js";
import { InventoryService } from "./inventory.service.js";

// Command Schema
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

export class BookingService extends Effect.Service<BookingService>()(
	"BookingService",
	{
		effect: Effect.gen(function* () {
			// Dependencies Injection
			const inventoryService = yield* InventoryService;
			const bookingRepo = yield* BookingRepository;
			const paymentGateway = yield* PaymentGateway;
			const notificationGateway = yield* NotificationGateway;
			const unitOfWork = yield* UnitOfWork;

			// Retry policy: exponential backoff with max 3 retries
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
						const bookingId = `booking-${Date.now()}` as typeof BookingId.Type;

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

						// 4. Confirm Booking using aggregate method (emits BookingConfirmed event)
						const confirmedBooking = yield* booking.confirm();

						// Save confirmed booking within transaction
						yield* unitOfWork.transaction(bookingRepo.save(confirmedBooking));

						// 5. Issue Ticket
						const coupon = new Coupon({
							couponNumber: 1,
							flightId: makeFlightId(command.flightId),
							seatNumber: command.seatNumber,
							status: "OPEN",
						});

						const ticket = new Ticket({
							ticketNumber: TicketNumber.make("1234567890123"),
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
			};
		}),
	},
) {}

const generateUniquePnr = (
	bookingRepo: BookingRepositoryPort,
): Effect.Effect<PnrCode> => {
	return Effect.gen(function* () {
		// 1. Generate candidate
		const randomBytes = Crypto.randomBytes(4); // 4 bytes = 8 hex chars, ample for 6 char alphanumeric
		// We want uppercase alphanumeric.
		// A simple way is to map random bytes to charset.
		const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
		let candidate = "";
		for (const byte of randomBytes) {
			candidate += charset[byte % charset.length];
		}
		// Ensure exactly 6 chars
		if (candidate.length > 6) candidate = candidate.slice(0, 6);
		while (candidate.length < 6) {
			// Pad if somehow short (unlikely with this logic, but good for safety)
			const byte = Crypto.randomBytes(1)[0];
			if (byte === undefined) continue;
			candidate += charset[byte % charset.length];
		}

		// 2. Validate format (Fail fast if logic is wrong)
		const pnr = Schema.decodeSync(PnrCodeSchema)(candidate);

		// 3. Check uniqueness
		// findByPnr succeeds if found, fails if not found.
		// We want it to NOT be found.
		const existing = yield* bookingRepo.findByPnr(pnr).pipe(
			Effect.map(() => true), // Found matches
			Effect.catchTag("BookingNotFoundError", () => Effect.succeed(false)), // Not found
		);

		if (existing) {
			// Collision - retry recursively
			return yield* generateUniquePnr(bookingRepo);
		}

		return pnr;
	});
};
