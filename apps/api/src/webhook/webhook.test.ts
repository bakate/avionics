import {
  type BookingConfirmation,
  BookingService,
} from "@workspace/application/booking.service";
import { Booking } from "@workspace/domain/booking";
import {
  BookingNotFoundError,
  BookingPersistenceError,
} from "@workspace/domain/errors";
import {
  BookingId,
  type Email,
  Money,
  makeBookingId,
  makeFlightId,
  makePnrCode,
  makeSegmentId,
} from "@workspace/domain/kernel";
import { Passenger, type PassengerId } from "@workspace/domain/passenger";
import { BookingSegment } from "@workspace/domain/segment";
import { Effect, Layer, Option as O } from "effect";
import { describe, expect, it, vi } from "vitest";
import { handlePolarWebhook } from "./api-live.js";

const buildBooking = (id: string, pnr: string) =>
  Booking.create({
    id: makeBookingId(id),
    pnrCode: makePnrCode(pnr),
    passengers: [
      new Passenger({
        id: "550e8400-e29b-41d4-a716-446655440001" as PassengerId,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com" as Email,
        dateOfBirth: new Date("1990-01-01"),
        gender: "MALE",
        type: "ADULT",
      }),
    ],
    segments: [
      new BookingSegment({
        id: makeSegmentId("550e8400-e29b-41d4-a716-446655440002"),
        flightId: makeFlightId("AF123"),
        cabin: "ECONOMY",
        price: Money.of(100, "EUR"),
        seatNumber: O.none(),
      }),
    ],
    expiresAt: O.none(),
  });

describe("Webhook API Handler", () => {
  it("should confirm booking on polar checkout.succeeded event", async () => {
    // 1. Setup Mocks
    const bookingId = "550e8400-e29b-41d4-a716-446655440000";
    const mockBooking = buildBooking(bookingId, "ABC123");

    const confirmBookingMock = vi.fn((_id: BookingId) =>
      Effect.succeed({
        booking: mockBooking,
        ticket: {} as any,
      } as BookingConfirmation),
    );

    const MockBookingService = Layer.succeed(
      BookingService,
      BookingService.of({
        confirmBooking: confirmBookingMock,
        bookFlight: () => Effect.die("Not implemented"),
        findAll: () => Effect.die("Not implemented"),
      }),
    );

    // 2. Prepare Payload
    const payload = {
      type: "checkout.succeeded",
      data: {
        metadata: {
          bookingId,
        },
      },
    };

    // 3. Execute Handler
    const result = await Effect.runPromise(
      handlePolarWebhook(payload).pipe(Effect.provide(MockBookingService)),
    );

    // 4. Assertions
    expect(result).toEqual({ received: true });
    expect(confirmBookingMock).toHaveBeenCalledWith(BookingId.make(bookingId));
  });

  it("should ignore events other than checkout.succeeded", async () => {
    // 1. Setup Mocks
    const confirmBookingMock = vi.fn(() => Effect.succeed({} as any));

    const MockBookingService = Layer.succeed(
      BookingService,
      BookingService.of({
        confirmBooking: confirmBookingMock,
        bookFlight: () => Effect.die("Not implemented"),
        findAll: () => Effect.die("Not implemented"),
      }),
    );

    // 2. Prepare Payload
    const payload = {
      type: "other_event",
      data: {},
    };

    // 3. Execute Handler
    const result = await Effect.runPromise(
      handlePolarWebhook(payload).pipe(Effect.provide(MockBookingService)),
    );

    // 4. Assertions
    expect(result).toEqual({ received: true });
    expect(confirmBookingMock).not.toHaveBeenCalled();
  });

  it("should fail with TransientError for infrastructure errors (triggering retry)", async () => {
    // 1. Setup Mocks with transient error
    const MockBookingService = Layer.succeed(
      BookingService,
      BookingService.of({
        confirmBooking: (id: BookingId) =>
          Effect.fail(
            new BookingPersistenceError({
              bookingId: String(id),
              reason: "Database down",
            }),
          ),
        bookFlight: () => Effect.die("Not implemented"),
        findAll: () => Effect.die("Not implemented"),
      }),
    );

    const payload = {
      type: "checkout.succeeded",
      data: {
        metadata: {
          bookingId: "550e8400-e29b-41d4-a716-446655440000",
        },
      },
    };

    // 3. Execute Handler - should fail as it's a transient error
    const result = await Effect.runPromise(
      handlePolarWebhook(payload).pipe(
        Effect.provide(MockBookingService),
        Effect.either,
      ),
    );

    // 4. Assertions - Should be Left (failure)
    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left._tag).toBe("TransientError");
    }
  });

  it("should swallow business errors and return received: true (preventing useless retries)", async () => {
    // 1. Setup Mocks with business error (NotFoundError)
    const MockBookingService = Layer.succeed(
      BookingService,
      BookingService.of({
        confirmBooking: (id: BookingId) =>
          Effect.fail(
            new BookingNotFoundError({
              searchkey: String(id),
            }),
          ),
        bookFlight: () => Effect.die("Not implemented"),
        findAll: () => Effect.die("Not implemented"),
      }),
    );

    const payload = {
      type: "checkout.succeeded",
      data: {
        metadata: {
          bookingId: "550e8400-e29b-41d4-a716-446655440000",
        },
      },
    };

    // 3. Execute Handler - should succeed by swallowing the business error
    const result = await Effect.runPromise(
      handlePolarWebhook(payload).pipe(Effect.provide(MockBookingService)),
    );

    // 4. Assertions
    expect(result).toEqual({ received: true });
  });
});
