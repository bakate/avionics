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
  Money,
  makeFlightId,
  makeSegmentId,
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
import {
  type CheckoutSession,
  type PaymentError,
  PaymentGateway,
  type PaymentGatewayService,
} from "../gateways/payment.gateway.js";
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
  successUrl: Schema.String, // URL for payment redirect success
  cancelUrl: Schema.optional(Schema.String), // Optional cancel URL
}) {}

// ---------------------------------------------------------------------------
// Service Interface
// ---------------------------------------------------------------------------

/**
 * Booking result containing the booking and optional checkout session
 * If checkout is present, client must redirect to checkoutUrl for payment
 */
export interface BookingResult {
  readonly booking: Booking;
  readonly checkout?: CheckoutSession;
}

export interface BookingServiceImpl {
  /**
   * Initiates a booking and creates a checkout session for payment
   *
   * Flow:
   * 1. Hold seats in inventory
   * 2. Create booking with HELD status
   * 3. Create checkout session with payment provider
   * 4. Return booking + checkout URL
   *
   * In test mode: polling returns "completed" immediately, booking is confirmed
   * In production: webhook/polling confirms payment asynchronously
   */
  bookFlight: (
    command: BookFlightCommand,
  ) => Effect.Effect<
    BookingResult,
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
    | PaymentError
    | Cause.TimeoutException
    | { readonly _tag: "SqlError" }
  >;
  findAll: () => Effect.Effect<ReadonlyArray<Booking>, BookingPersistenceError>;
  /**
   * Confirms a booking after successful payment
   * Validates payment status, updates booking status, issues ticket, and sends notification
   */
  confirmBooking: (
    bookingId: BookingId,
  ) => Effect.Effect<
    Booking,
    | BookingNotFoundError
    | BookingPersistenceError
    | OptimisticLockingError
    | BookingStatusError
    | BookingExpiredError
    | { readonly _tag: "SqlError" }
  >;
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

      const confirmBooking = (bookingId: BookingId) =>
        Effect.gen(function* () {
          const booking = yield* bookingRepo.findById(bookingId).pipe(
            Effect.flatMap(
              O.match({
                onNone: () =>
                  Effect.fail(
                    new BookingNotFoundError({ searchkey: bookingId }),
                  ),
                onSome: (b) => Effect.succeed(b),
              }),
            ),
          );

          const confirmedBooking = yield* Effect.gen(function* () {
            const confirmed = yield* booking.confirm();
            return yield* unitOfWork.transaction(bookingRepo.save(confirmed));
          }).pipe(
            Effect.retry({
              times: 3,
              while: (error) => error instanceof OptimisticLockingError,
            }),
          );

          const passenger = booking.passengers[0];
          const segment = booking.segments[0];

          const coupon = new Coupon({
            couponNumber: 1,
            flightId: segment.flightId,
            seatNumber: segment.seatNumber,
            status: "OPEN",
          });

          const ticketNumber = yield* generateTicketNumber();

          const ticket = new Ticket({
            ticketNumber,
            pnrCode: booking.pnrCode,
            status: TicketStatus.ISSUED,
            passengerId: passenger.id,
            passengerName: `${passenger.firstName} ${passenger.lastName}`,
            coupons: [coupon],
            issuedAt: new Date(),
          });

          yield* notificationGateway.sendTicket(ticket, passenger.email).pipe(
            Effect.retry(retryPolicy),
            Effect.timeout(Duration.seconds(10)),
            Effect.catchAll((err) =>
              Effect.logError("Failed to send email notification", err),
            ),
          );

          return confirmedBooking;
        });

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
              id: makeSegmentId(Crypto.randomUUID()),
              flightId: makeFlightId(command.flightId),
              cabin: command.cabinClass,
              price: holdResult.totalPrice,
              seatNumber: command.seatNumber,
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

            // 3. Create Checkout Session for payment
            const checkoutSession = yield* paymentGateway
              .createCheckout({
                amount: holdResult.totalPrice,
                customer: {
                  email: command.passenger.email,
                  externalId: command.passenger.id, // Future: userId when auth is implemented
                },
                bookingReference: pnr,
                successUrl: command.successUrl,
                ...(command.cancelUrl ? { cancelUrl: command.cancelUrl } : {}),
              })
              .pipe(
                Effect.retry(retryPolicy),
                Effect.timeout(Duration.seconds(30)),
              );

            // 4. Poll for checkout status (for tests) or return for redirect (production)
            if (process.env.NODE_ENV !== "test") {
              return {
                booking,
                checkout: checkoutSession,
              } satisfies BookingResult;
            }

            // In test mode, getCheckoutStatus returns "completed" immediately
            const checkoutStatus = yield* paymentGateway
              .getCheckoutStatus(checkoutSession.id)
              .pipe(
                Effect.retry(retryPolicy),
                Effect.timeout(Duration.seconds(5)),
              );

            // 5. Handle checkout status
            if (checkoutStatus.status === "completed") {
              const confirmedBooking = yield* confirmBooking(booking.id);
              return { booking: confirmedBooking } satisfies BookingResult;
            }

            if (checkoutStatus.status === "expired") {
              // Payment expired - release seats and cancel booking
              // The expired checkout session is NOT returned to avoid confusion.
              // Callers must create a new booking to retry payment.
              yield* Effect.logError("Payment expired. Rolling back seats.");

              yield* inventoryService.releaseSeats({
                flightId: makeFlightId(command.flightId),
                cabin: command.cabinClass,
                numberOfSeats: 1,
              });

              const cancelledBooking = yield* booking.cancel("Payment expired");
              yield* unitOfWork.transaction(bookingRepo.save(cancelledBooking));

              // Only return the cancelled booking - no checkout property
              // This signals to the caller that payment failed and a new booking is needed
              return { booking: cancelledBooking } satisfies BookingResult;
            }

            // Status is "pending" - return booking with checkout URL for redirect
            return {
              booking,
              checkout: checkoutSession,
            } satisfies BookingResult;
          }),

        findAll: () => bookingRepo.findAll(),
        confirmBooking,
      } satisfies BookingServiceImpl;
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
    paymentGateway?: Partial<PaymentGatewayService>;
    notificationGateway?: Partial<typeof NotificationGateway.Service>;
    unitOfWork?: Partial<typeof UnitOfWork.Service>;
  };

  /**
   * Test Layer — Factory that returns a complete Layer for tests.
   *
   * Default behaviors (without override):
   *   - PaymentGateway.createCheckout  → Returns test checkout URL
   *   - PaymentGateway.getCheckoutStatus → Returns "completed" immediately
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
            Ref.update(store, (map) => {
              const newMap = new Map(map);
              newMap.set(booking.id, booking);
              return newMap;
            }).pipe(Effect.map(() => booking)),
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

    const PaymentGatewayTest = Layer.succeed(PaymentGateway, {
      createCheckout: (params) =>
        Effect.gen(function* () {
          const checkoutId = `checkout_test_${Date.now()}`;
          yield* Effect.logDebug("Test checkout created", {
            checkoutId,
            bookingReference: params.bookingReference,
          });
          return {
            id: checkoutId,
            checkoutUrl: `https://test.polar.sh/checkout/${checkoutId}`,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          };
        }),
      getCheckoutStatus: (checkoutId) =>
        Effect.gen(function* () {
          yield* Effect.logDebug("Test checkout status", { checkoutId });
          // Instantly return completed for tests
          return {
            status: "completed" as const,
            confirmation: {
              checkoutId,
              transactionId: `txn_test_${Date.now()}`,
              paidAt: new Date(),
              amount: Money.of(100, "EUR"),
            },
          };
        }),
      ...overrides.paymentGateway,
    } satisfies PaymentGatewayService);

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
  paymentGateway?: Partial<PaymentGatewayService>;
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
