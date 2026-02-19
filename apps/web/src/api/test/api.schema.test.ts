import {
  HttpApiClient,
  HttpClient,
  HttpClientResponse,
} from "@effect/platform";
import { faker } from "@faker-js/faker";
import { Api } from "@workspace/api/api";
import { BookingId } from "@workspace/domain/kernel";
import { Effect, Layer, Option as O } from "effect";
import { describe, expect, it } from "vitest";

describe("API Schema Validation", () => {
  it("should correctly decode a booking response", async () => {
    const bookingId = faker.string.uuid();
    const pnrCode = faker.string.alphanumeric(6).toUpperCase();
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email();
    const dateOfBirth = faker.date.birthdate().toISOString();
    const createdAt = faker.date.recent().toISOString();
    const flightId = `FL-${faker.number.int({ min: 100, max: 999 })}`;

    const mockBooking = {
      id: bookingId,
      pnrCode: pnrCode,
      status: "Confirmed",
      passengers: [
        {
          id: faker.string.uuid(),
          firstName,
          lastName,
          email,
          dateOfBirth,
          gender: faker.helpers.arrayElement(["MALE", "FEMALE"]),
          type: "ADULT",
        },
      ],
      segments: [
        {
          id: faker.string.uuid(),
          flightId,
          cabin: "ECONOMY",
          price: {
            amount: faker.number.int({ min: 50, max: 1000 }),
            currency: "EUR",
          },
          seatNumber: { _tag: "None" },
        },
      ],
      expiresAt: { _tag: "None" },
      createdAt,
    };

    // Create a mock HttpClient that returns the mock booking
    const MockHttpClient = HttpClient.make((request) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          new Response(JSON.stringify(mockBooking), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      ),
    );

    const program = Effect.gen(function* () {
      const client = yield* HttpApiClient.make(Api, {
        baseUrl: "http://localhost:3000",
      });

      const result = yield* client.bookings.confirm({
        path: { id: BookingId.make(bookingId) },
      });

      expect(result.id).toBe(bookingId);
      expect(result.pnrCode).toBe(pnrCode);
      expect(result.status).toBe("Confirmed");
      expect(result.passengers[0].firstName).toBe(firstName);
      expect(O.isNone(result.expiresAt)).toBe(true);
    });

    await Effect.runPromise(
      program.pipe(
        Effect.provide(Layer.succeed(HttpClient.HttpClient, MockHttpClient)),
      ),
    );
  });

  it("should handle error decoding", async () => {
    const errorUuid = faker.string.uuid();
    const mockError = {
      _tag: "BookingNotFoundError",
      searchkey: errorUuid,
    };

    const MockHttpClient = HttpClient.make((request) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          new Response(JSON.stringify(mockError), {
            status: 404,
            headers: { "content-type": "application/json" },
          }),
        ),
      ),
    );

    const program = Effect.gen(function* () {
      const client = yield* HttpApiClient.make(Api, {
        baseUrl: "http://localhost:3000",
      });

      const result = yield* client.bookings
        .confirm({
          path: { id: BookingId.make(errorUuid) },
        })
        .pipe(Effect.flip);

      expect(result._tag).toBe("BookingNotFoundError");
    });

    await Effect.runPromise(
      program.pipe(
        Effect.provide(Layer.succeed(HttpClient.HttpClient, MockHttpClient)),
      ),
    );
  });
});
