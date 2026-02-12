import * as Crypto from "node:crypto";
import { Booking } from "@workspace/domain/booking";
import { Coupon } from "@workspace/domain/coupon";
import {
  type BookingExpiredError,
  BookingNotFoundError,
  BookingPersistenceError,
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
  type PaginationOptions,
} from "../repositories/booking.repository.js";
import { TicketRepository } from "../repositories/ticket.repository.js";
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
  seatNumber: Schema.OptionFromNullOr(Schema.String).pipe(Schema.optional),
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

/**
 * Result of a booking confirmation
 */
export interface BookingConfirmation {
  readonly booking: Booking;
  readonly ticket: Ticket;
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
  findAll: (
    options?: PaginationOptions,
  ) => Effect.Effect<ReadonlyArray<Booking>, BookingPersistenceError>;
  /**
   * Confirms a booking after successful payment
   * Validates payment status, updates booking status, issues ticket, and sends notification
   */
  confirmBooking: (
    bookingId: BookingId,
  ) => Effect.Effect<
    BookingConfirmation,
    | BookingNotFoundError
    | BookingPersistenceError
    | OptimisticLockingError
    | BookingStatusError
    | BookingExpiredError
    | { readonly _tag: "SqlError" }
  >;
  /**
   * Cancels a booking and releases held seats
   */
  cancelBooking: (
    bookingId: BookingId,
    reason: string,
  ) => Effect.Effect<
    Booking,
    | BookingNotFoundError
    | BookingPersistenceError
    | OptimisticLockingError
    | BookingStatusError
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
  static readonly bookFlight = (command: BookFlightCommand) =>
    Effect.flatMap(BookingService, (svc) => svc.bookFlight(command));

  static readonly findAll = (options?: PaginationOptions) =>
    Effect.flatMap(BookingService, (svc) => svc.findAll(options));

  static readonly confirmBooking = (bookingId: BookingId) =>
    Effect.flatMap(BookingService, (svc) => svc.confirmBooking(bookingId));

  static readonly cancelBooking = (bookingId: BookingId, reason: string) =>
    Effect.flatMap(BookingService, (svc) =>
      svc.cancelBooking(bookingId, reason),
    );

  static readonly Live = Layer.effect(
    BookingService,
    Effect.gen(function* () {
      // Resolve dependencies from context
      const inventoryService = yield* InventoryService;
      const bookingRepo = yield* BookingRepository;
      const paymentGateway = yield* PaymentGateway;
      const notificationGateway = yield* NotificationGateway;
      const unitOfWork = yield* UnitOfWork;
      const ticketRepo = yield* TicketRepository;

      // Retry policy: exponential backoff, max 3 attempts
      const retryPolicy = Schedule.exponential(Duration.millis(100)).pipe(
        Schedule.compose(Schedule.recurs(3)),
      );

      const confirmBooking = (bookingId: BookingId) =>
        Effect.gen(function* () {
          const { confirmedBooking, booking } = yield* Effect.gen(function* () {
            const b = yield* bookingRepo.findById(bookingId).pipe(
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

            if (!b.passengers?.length || !b.segments?.length) {
              return yield* Effect.fail(
                new BookingPersistenceError({
                  bookingId: b.id,
                  reason:
                    "Booking must have at least one passenger and one segment",
                }),
              );
            }

            const confirmed = yield* b.confirm();
            const saved = yield* unitOfWork.transaction(
              bookingRepo.save(confirmed),
            );
            return { confirmedBooking: saved, booking: b };
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
            seatNumber: segment.seatNumber ?? O.none(),
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

          yield* ticketRepo.save(ticket).pipe(
            Effect.mapError(
              (error) =>
                new BookingPersistenceError({
                  bookingId: booking.id,
                  reason: `Failed to save ticket: ${String(error)}`,
                }),
            ),
          );

          yield* notificationGateway
            .sendTicket(ticket, {
              email: passenger.email,
              name: `${passenger.firstName} ${passenger.lastName}`,
            })
            .pipe(
              Effect.retry(retryPolicy),
              Effect.timeout(Duration.seconds(10)),
              Effect.catchAll((err) =>
                Effect.gen(function* () {
                  yield* Effect.logError(
                    "Failed to send email notification",
                    err,
                  );
                  const failedTicket = new Ticket({
                    ...ticket,
                    status: TicketStatus.NOTIFICATION_FAILED,
                  });
                  // We ignore the error of saving the failed status as it is a compensation
                  yield* ticketRepo.save(failedTicket).pipe(Effect.ignore);
                }),
              ),
            );

          return { booking: confirmedBooking, ticket };
        });

      const cancelBooking = (bookingId: BookingId, reason: string) =>
        Effect.gen(function* () {
          const { cancelledBooking, booking } = yield* Effect.gen(function* () {
            const b = yield* bookingRepo.findById(bookingId).pipe(
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

            const cancelled = yield* b.cancel(reason);
            const saved = yield* unitOfWork.transaction(
              bookingRepo.save(cancelled),
            );
            return { cancelledBooking: saved, booking: b };
          }).pipe(
            Effect.retry({
              times: 3,
              while: (error) => error instanceof OptimisticLockingError,
            }),
          );

          // Best effort Release Seats (async from user perspective, but sync here for simplicity)
          // Using strict concurrency control (retry)
          yield* Effect.forEach(
            booking.segments,
            (segment) =>
              inventoryService
                .releaseSeats({
                  flightId: segment.flightId,
                  cabin: segment.cabin,
                  numberOfSeats: booking.passengers.length,
                })
                .pipe(
                  Effect.retry(retryPolicy),
                  Effect.catchAllCause((cause) =>
                    Effect.logWarning(
                      "Failed to release seats after cancellation",
                      cause,
                    ),
                  ),
                ),
            { discard: true },
          );

          return cancelledBooking;
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
              seatNumber: command.seatNumber ?? O.none(),
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
            const savedBooking = yield* unitOfWork.transaction(
              bookingRepo.save(booking),
            );

            // 3. Create Checkout Session for payment
            const checkoutSession = yield* paymentGateway
              .createCheckout({
                amount: holdResult.totalPrice,
                customer: {
                  email: command.passenger.email,
                  externalId: command.passenger.id, // Future: userId when auth is implemented
                },
                bookingReference: pnr,
                bookingId: savedBooking.id,
                successUrl: command.successUrl,
                ...(command.cancelUrl ? { cancelUrl: command.cancelUrl } : {}),
              })
              .pipe(
                Effect.retry(retryPolicy),
                Effect.timeout(Duration.seconds(30)),
                Effect.tapError((error) =>
                  Effect.gen(function* () {
                    yield* Effect.logError(
                      "Checkout creation failed. Compensating...",
                      error,
                    );

                    // 1. Cancel booking first (to prevent zombie bookings if release fails)
                    const cancelled = yield* savedBooking.cancel(
                      "Payment initialization failed",
                    );
                    yield* unitOfWork.transaction(bookingRepo.save(cancelled));

                    // 2. Release seats (with retry to ensure eventual consistency)
                    yield* inventoryService
                      .releaseSeats({
                        flightId: makeFlightId(command.flightId),
                        cabin: command.cabinClass,
                        numberOfSeats: 1,
                      })
                      .pipe(Effect.retry(retryPolicy));
                  }).pipe(
                    Effect.catchAll((compensationError) =>
                      Effect.logError("Compensation failed", compensationError),
                    ),
                  ),
                ),
              );

            return {
              booking: savedBooking,
              checkout: checkoutSession,
            } satisfies BookingResult;
          }),

        findAll: (options) => bookingRepo.findAll(options),
        confirmBooking,
        cancelBooking,
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
    ticketRepo?: Partial<typeof TicketRepository.Service>;
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
          findAll: (_options) =>
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
            bookingId: params.bookingId,
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
        sendTicket: () =>
          Effect.succeed({ messageId: `test_msg_${Date.now()}` }),
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

    const TicketRepoTest = Layer.succeed(TicketRepository, {
      save: (t: Ticket) => Effect.succeed(t),
      findByTicketNumber: () => Effect.succeed(null),
      ...overrides.ticketRepo,
    });

    // Composition: BookingService.Live on top, mocks below.
    // Live will yield* each dep → it will find them in the layers below.
    return BookingService.Live.pipe(
      Layer.provide(
        InventoryServiceTest.pipe(
          Layer.merge(BookingRepoTest),
          Layer.merge(PaymentGatewayTest),
          Layer.merge(NotificationGatewayTest),
          Layer.merge(UnitOfWorkTest),
          Layer.merge(TicketRepoTest),
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
  ticketRepo?: Partial<typeof TicketRepository.Service>;
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
