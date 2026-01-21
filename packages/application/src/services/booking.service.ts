import * as Crypto from "node:crypto";
import { Booking, type BookingId, PnrStatus } from "@workspace/domain/booking";
import { Coupon } from "@workspace/domain/coupon";
import { FlightId } from "@workspace/domain/flight";
import {
  CabinClassSchema,
  EmailSchema,
  GenderSchema,
  PassengerTypeSchema,
  type PnrCode,
  PnrCodeSchema,
} from "@workspace/domain/kernel";
import { Passenger, PassengerId } from "@workspace/domain/passenger";
import { BookingSegment } from "@workspace/domain/segment";
import { Ticket, TicketNumber, TicketStatus } from "@workspace/domain/ticket";
import { Effect, Option as O, Schema } from "effect";
import { NotificationGateway } from "../gateways/notification.gateway.js";
import { PaymentGateway } from "../gateways/payment.gateway.js";
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

      return {
        bookFlight: (command: BookFlightCommand) =>
          Effect.gen(function* () {
            // 1. Hold seats and get price
            const { price: totalPrice } = yield* inventoryService.holdSeats({
              flightId: FlightId.make(command.flightId),
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
              flightId: FlightId.make(command.flightId),
              cabin: command.cabinClass,
              price: totalPrice,
            });

            // 2.5. Create Booking
            const booking = new Booking({
              id: bookingId,
              pnrCode: pnr,
              status: PnrStatus.HELD,
              passengers: [passenger],
              segments: [segment],
              createdAt: new Date(),
              expiresAt: O.some(new Date(Date.now() + 30 * 60 * 1000)), // 30 min to pay
            });

            // 2.6. Save Booking with HELD status
            yield* bookingRepo.save(booking);

            // 3. Process Payment
            yield* paymentGateway
              .charge(totalPrice, command.creditCardToken)
              .pipe(
                // 3.1 If payment fails, release seats
                Effect.catchAll((paymentError) =>
                  Effect.gen(function* () {
                    yield* Effect.logError(
                      "Payment failed. We rolled back seats.",
                      paymentError,
                    );
                    // A. Compensate
                    yield* inventoryService.releaseSeats({
                      flightId: FlightId.make(command.flightId),
                      cabin: command.cabinClass,
                      numberOfSeats: 1,
                    });
                    // B. Update Booking status to FAILED
                    yield* bookingRepo.save(
                      new Booking({
                        ...booking,
                        status: PnrStatus.CANCELLED,
                        expiresAt: O.none(),
                      }),
                    );
                    // Re-fail : We return the original error to the client
                    return yield* Effect.fail(paymentError);
                  }),
                ),
              );

            // 4. Confirm Booking
            const confirmedBooking = new Booking({
              ...booking,
              status: PnrStatus.CONFIRMED,
              expiresAt: O.none(),
            });
            yield* bookingRepo.save(confirmedBooking);

            // 5. Issue Ticket
            const coupon = new Coupon({
              couponNumber: 1,
              flightId: FlightId.make(command.flightId),
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
            //6. Send notification
            yield* notificationGateway
              .sendTicket(ticket, command.passenger.email)
              .pipe(
                Effect.catchAll((err) =>
                  Effect.logError("Failed to send email", err),
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
