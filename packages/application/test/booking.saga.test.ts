import { faker } from "@faker-js/faker";
import { type Booking, PnrStatus } from "@workspace/domain/booking";
import { type BookingId, EmailSchema, Money } from "@workspace/domain/kernel";
import { Effect, Exit, Option, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { PaymentApiUnavailableError } from "../src/gateways/payment.gateway.js";
import { BookingService } from "../src/services/booking.service.js";

describe("Booking Saga Integration", () => {
  // Shared test command
  // Shared test command
  const command = {
    flightId: "flight_" + faker.string.alphanumeric(5),
    cabinClass: "ECONOMY" as const,
    passenger: {
      id: faker.string.uuid(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: Schema.decodeSync(EmailSchema)(faker.internet.email()),
      dateOfBirth: faker.date.birthdate(),
      gender: "MALE" as const,
      type: "ADULT" as const,
    },
    successUrl: faker.internet.url(),
    cancelUrl: faker.internet.url(),
  };

  it("should successfully create a booking when all services succeed", async () => {
    // Setup: Default Test Layer (Everything succeeds)
    const BookingTestLayer = BookingService.Test({
      outboxRepo: {
        persist: () => Effect.void,
      },
    });

    const result = await Effect.runPromise(
      BookingService.bookFlight(command).pipe(Effect.provide(BookingTestLayer)),
    );

    expect(result.booking.status).toBe(PnrStatus.HELD);
    expect(result.checkout).toBeDefined();
    expect(result.checkout?.id).toContain("checkout_test");
  });

  it("should compensate (cancel booking + release seats) when payment initialization fails", async () => {
    // 1. Capture state outside the effect
    const bookingStore = new Map<BookingId, Booking>();
    let seatsReleased = false;

    // 2. Define custom mocks
    // Note: We need a mutable reference that persists across effects
    const CustomLayer = BookingService.Test({
      outboxRepo: {
        persist: () => Effect.void,
      },
      bookingRepo: {
        save: (b) =>
          Effect.sync(() => {
            bookingStore.set(b.id, b);
            return b;
          }),
        findById: (id) =>
          Effect.sync(() => Option.fromNullable(bookingStore.get(id))),
        findAll: () => Effect.succeed([]),
      },
      inventoryService: {
        holdSeats: () =>
          Effect.succeed({
            totalPrice: Money.of(100, "EUR"),
            unitPrice: Money.of(100, "EUR"),
            seatsHeld: 1,
            holdExpiresAt: new Date(),
            inventory: {} as any, // Dummy
          }),
        releaseSeats: () =>
          Effect.sync(() => {
            seatsReleased = true;
            return { seatsReleased: 1, inventory: {} as any };
          }),
        getAvailability: () => Effect.die("Not implemented"),
      },
      paymentGateway: {
        createCheckout: () =>
          Effect.fail(
            new PaymentApiUnavailableError({
              message: "Polar down",
            }),
          ),
      },
    });

    // 3. Run the failing saga and capture Exit
    const exit = await Effect.runPromiseExit(
      BookingService.bookFlight(command).pipe(Effect.provide(CustomLayer)),
    );

    // 4. Assert Failure
    expect(Exit.isFailure(exit)).toBe(true);

    // 5. Verification of Compensation
    const savedBooking = Array.from(bookingStore.values())[0];

    // Booking should exist
    expect(savedBooking).toBeDefined();

    // Booking should be CANCELLED (Compensation step 1)
    expect(savedBooking?.status).toBe(PnrStatus.CANCELLED);

    // Seats should be RELEASED (Compensation step 2)
    expect(seatsReleased).toBe(true);
  });
});
