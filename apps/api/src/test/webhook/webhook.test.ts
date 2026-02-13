/** biome-ignore-all lint/style/noRestrictedImports: <explanation> */
import { HttpServerRequest } from "@effect/platform";
import {
  type BookingConfirmation,
  BookingService,
} from "@workspace/application/booking.service";
import { ApiConfig } from "@workspace/config";
import { Booking } from "@workspace/domain/booking";
import {
  BookingNotFoundError,
  BookingPersistenceError,
} from "@workspace/domain/errors";
import {
  BookingId,
  CabinClass,
  EmailSchema,
  Money,
  makeBookingId,
  makeFlightId,
  makePnrCode,
  makeSegmentId,
  PassengerType,
} from "@workspace/domain/kernel";
import { Passenger, PassengerId } from "@workspace/domain/passenger";
import { BookingSegment } from "@workspace/domain/segment";
import { Effect, Layer, Option as O, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import { handlePolarWebhook } from "../../webhook/api-live.js";

const buildBooking = (id: string, pnr: string) =>
  Booking.create({
    id: makeBookingId(id),
    pnrCode: makePnrCode(pnr),
    passengers: [
      new Passenger({
        id: PassengerId.make("550e8400-e29b-41d4-a716-446655440001"),
        firstName: "John",
        lastName: "Doe",
        email: Schema.decodeSync(EmailSchema)("john@example.com"),
        dateOfBirth: new Date("1990-01-01"),
        gender: "MALE",
        type: PassengerType.ADULT,
      }),
    ],
    segments: [
      new BookingSegment({
        id: makeSegmentId("550e8400-e29b-41d4-a716-446655440002"),
        flightId: makeFlightId("AF123"),
        cabin: CabinClass.ECONOMY,
        price: Money.of(100, "EUR"),
        seatNumber: O.none(),
      }),
    ],
    expiresAt: O.none(),
  });

// Setup Dummy Dependencies to satisfy requirements
const MockApiConfig = Layer.succeed(ApiConfig, {} as any);
const MockHttpServerRequest = Layer.succeed(
  HttpServerRequest.HttpServerRequest,
  {} as any,
);

describe("Webhook API Handler", () => {
  it("should confirm booking on polar checkout.updated(succeeded) event", async () => {
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
        cancelBooking: () => Effect.die("Not implemented"),
      } as any),
    );

    // 2. Prepare Payload
    const payload = {
      type: "checkout.updated",
      data: {
        id: "ch_123",
        status: "succeeded",
        metadata: {
          bookingId,
        },
      },
    };

    // 3. Execute Handler
    const result = await Effect.runPromise(
      handlePolarWebhook(payload).pipe(
        Effect.provide(MockBookingService),
        Effect.provide(MockApiConfig),
        Effect.provide(MockHttpServerRequest),
      ),
    );

    // 4. Assertions
    expect(result).toEqual({ received: true });
    expect(confirmBookingMock).toHaveBeenCalledWith(BookingId.make(bookingId));
  });

  it("should ignore events other than checkout.updated with status succeeded", async () => {
    // 1. Setup Mocks
    const confirmBookingMock = vi.fn(() => Effect.succeed({} as any));

    const MockBookingService = Layer.succeed(
      BookingService,
      BookingService.of({
        confirmBooking: confirmBookingMock,
        bookFlight: () => Effect.die("Not implemented"),
        findAll: () => Effect.die("Not implemented"),
        cancelBooking: () => Effect.die("Not implemented"),
      } as any),
    );

    // 2. Prepare Payload
    const payload = {
      type: "other_event",
      data: {},
    };

    // 3. Execute Handler
    const result = await Effect.runPromise(
      handlePolarWebhook(payload).pipe(
        Effect.provide(MockBookingService),
        Effect.provide(MockApiConfig),
        Effect.provide(MockHttpServerRequest),
      ),
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
        cancelBooking: () => Effect.die("Not implemented"),
      } as any),
    );

    const payload = {
      type: "checkout.updated",
      data: {
        id: "ch_123",
        status: "succeeded",
        metadata: {
          bookingId: "550e8400-e29b-41d4-a716-446655440000",
        },
      },
    };

    // 2. Execute Handler - should be caught and transformed to TransientError
    const result = await Effect.runPromise(
      handlePolarWebhook(payload).pipe(
        Effect.provide(MockBookingService),
        Effect.provide(MockApiConfig),
        Effect.provide(MockHttpServerRequest),
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
        cancelBooking: () => Effect.die("Not implemented"),
      } as any),
    );

    const payload = {
      type: "checkout.updated",
      data: {
        id: "ch_123",
        status: "succeeded",
        metadata: {
          bookingId: "550e8400-e29b-41d4-a716-446655440000",
        },
      },
    };

    // 2. Execute Handler - should succeed by swallowing the business error
    const result = await Effect.runPromise(
      handlePolarWebhook(payload).pipe(
        Effect.provide(MockBookingService),
        Effect.provide(MockApiConfig),
        Effect.provide(MockHttpServerRequest),
      ),
    );

    // 4. Assertions
    expect(result).toEqual({ received: true });
  });
});
