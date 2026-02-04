import { BookingRepository } from "@workspace/application/booking.repository";
import { PnrStatus } from "@workspace/domain/booking";
import { PnrCodeSchema } from "@workspace/domain/kernel";
import { Effect, Layer, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConnectionPoolLive } from "../../db/connection.js";
import { PostgresBookingRepositoryLive } from "../../repositories/postgres-booking.repository.js";
import { createTestBooking } from "../factories/booking-factory.js";
import { cleanDatabase } from "../helpers/db-test-helper.js";

const TestLayer = PostgresBookingRepositoryLive.pipe(
  Layer.provide(ConnectionPoolLive),
);

const runTest = <A, E>(effect: Effect.Effect<A, E, BookingRepository>) =>
  Effect.runPromise(Effect.provide(effect, TestLayer));

describe("BookingRepository Integration Tests", () => {
  // Clean database before each test
  beforeEach(async () => {
    await Effect.runPromise(Effect.provide(cleanDatabase, ConnectionPoolLive));
  });

  describe("save", () => {
    it("should create a new booking with passengers and segments", async () => {
      const booking = createTestBooking({
        pnrCode: "TEST01",
        passengerCount: 2,
        segmentCount: 1,
      });

      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* BookingRepository;
          yield* repo.save(booking);

          // Verify booking was saved
          const found = yield* repo.findByPnr(PnrCodeSchema.make("TEST01"));
          return Option.getOrThrow(found);
        }),
      );

      expect(result).toBeDefined();
      expect(result.pnrCode.valueOf()).toBe("TEST01");
      expect(result.passengers).toHaveLength(2);
      expect(result.segments).toHaveLength(1);
      expect(result?.version).toBe(1);
    });

    it("should update existing booking and increment version", async () => {
      const booking = createTestBooking({ pnrCode: "TEST02" });

      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* BookingRepository;

          // Create
          yield* repo.save(booking);

          // Update
          const foundOpt = yield* repo.findByPnr(PnrCodeSchema.make("TEST02"));
          const found = Option.getOrThrow(foundOpt);

          const updated = yield* found.confirm();
          yield* repo.save(updated);

          // Verify version incremented
          const finalOpt = yield* repo.findByPnr(PnrCodeSchema.make("TEST02"));
          return Option.getOrThrow(finalOpt);
        }),
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(PnrStatus.CONFIRMED);
      expect(result.version).toBe(2);
    });
  });

  describe("findByPnr", () => {
    it("should return None when booking does not exist", async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* BookingRepository;
          return yield* repo.findByPnr(PnrCodeSchema.make("NOTFND"));
        }),
      );

      expect(Option.isNone(result)).toBe(true);
    });

    it("should load booking with all relationships", async () => {
      const booking = createTestBooking({
        pnrCode: "TEST03",
        passengerCount: 3,
        segmentCount: 2,
      });

      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* BookingRepository;
          yield* repo.save(booking);

          const foundOpt = yield* repo.findByPnr(PnrCodeSchema.make("TEST03"));
          return Option.getOrThrow(foundOpt);
        }),
      );

      expect(result).toBeDefined();
      expect(result.passengers).toHaveLength(3);
      expect(result.segments).toHaveLength(2);
      expect(result.passengers[0]?.firstName).toBe("John0");
      expect(result.segments[0]?.flightId.valueOf()).toBe("FL000");
    });
  });

  // Skip delete test - method not implemented yet
  // describe("delete", () => { ... });

  describe("findExpired", () => {
    it("should return only expired bookings", async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago
      const future = new Date(now.getTime() + 1000 * 60 * 60); // 1 hour from now

      await runTest(
        Effect.gen(function* () {
          const repo = yield* BookingRepository;

          // Create expired booking
          const expired = createTestBooking({
            pnrCode: "EXP001",
            expiresAt: past,
          });
          yield* repo.save(expired);

          // Create non-expired booking
          const notExpired = createTestBooking({
            pnrCode: "ACT001",
            expiresAt: future,
          });
          yield* repo.save(notExpired);
        }),
      );

      const expiredBookings = await runTest(
        Effect.gen(function* () {
          const repo = yield* BookingRepository;
          return yield* repo.findExpired(now);
        }),
      );

      expect(expiredBookings).toHaveLength(1);
      expect(expiredBookings[0]?.pnrCode).toBe("EXP001");
    });
  });
});
