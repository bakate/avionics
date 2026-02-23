/** biome-ignore-all lint/style/noRestrictedImports: Testing environment needs node:http */
import { HttpServerRequest } from "@effect/platform";
import { faker } from "@faker-js/faker";
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
        id: PassengerId.make(faker.string.uuid()),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: Schema.decodeSync(EmailSchema)(faker.internet.email()),
        dateOfBirth: faker.date.birthdate(),
        gender: faker.helpers.arrayElement(["MALE", "FEMALE"]),
        type: PassengerType.ADULT,
      }),
    ],
    segments: [
      new BookingSegment({
        id: makeSegmentId(faker.string.uuid()),
        flightId: makeFlightId(
          faker.string.alphanumeric(2).toUpperCase() + faker.string.numeric(3),
        ),
        cabin: CabinClass.ECONOMY,
        price: Money.of(100, "EUR"),
        seatNumber: O.none(),
      }),
    ],
    expiresAt: O.none(),
  });

// Setup Dummy Dependencies to satisfy requirements
const MockHttpServerRequest = Layer.succeed(
  HttpServerRequest.HttpServerRequest,
  {} as any,
);

describe("Webhook API Handler", () => {
  it("should confirm booking on polar checkout.updated(succeeded) event", async () => {
    // 1. Setup Mocks
    const bookingId = faker.string.uuid();
    const mockBooking = buildBooking(
      bookingId,
      faker.string.alphanumeric(6).toUpperCase(),
    );

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
        id: `ch_${faker.string.alphanumeric(10)}`,
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
        Effect.provide(MockHttpServerRequest),
      ),
    );

    // 4. Assertions
    expect(result).toEqual({ received: true });
    expect(confirmBookingMock).not.toHaveBeenCalled();
  });

  it("should fail with TransientError for infrastructure errors (triggering retry)", async () => {
    // 1. Setup Mocks with transient error
    const bookingId = faker.string.uuid();
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
        id: `ch_${faker.string.alphanumeric(10)}`,
        status: "succeeded",
        metadata: {
          bookingId,
        },
      },
    };

    // 2. Execute Handler - should be caught and transformed to TransientError
    const result = await Effect.runPromise(
      handlePolarWebhook(payload).pipe(
        Effect.provide(MockBookingService),
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
    const bookingId = faker.string.uuid();
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
        id: `ch_${faker.string.alphanumeric(10)}`,
        status: "succeeded",
        metadata: {
          bookingId,
        },
      },
    };

    // 2. Execute Handler - should succeed by swallowing the business error
    const result = await Effect.runPromise(
      handlePolarWebhook(payload).pipe(
        Effect.provide(MockBookingService),
        Effect.provide(MockHttpServerRequest),
      ),
    );

    // 4. Assertions
    expect(result).toEqual({ received: true });
  });
});
