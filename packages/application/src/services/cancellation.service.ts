import { PnrStatus } from "@workspace/domain/booking";
import { Context, Duration, Effect, Layer, Schedule } from "effect";
import { UnitOfWork } from "../ports/unit-of-work.js";
import { BookingRepository } from "../repositories/booking.repository.js";
import { InventoryService } from "./inventory.service.js";

export interface CancellationServiceSignature {
  readonly processExpirations: () => Effect.Effect<void, never>;
  readonly start: () => Effect.Effect<never, never>;
}

export class CancellationService extends Context.Tag("CancellationService")<
  CancellationService,
  CancellationServiceSignature
>() {
  static readonly Live = Layer.effect(
    CancellationService,
    Effect.gen(function* () {
      const bookingRepo = yield* BookingRepository;
      const inventoryService = yield* InventoryService;
      const unitOfWork = yield* UnitOfWork;

      const processExpirations = () =>
        Effect.gen(function* () {
          const now = new Date();
          const expiredBookings = yield* bookingRepo.findExpired(now);
          const toExpire = expiredBookings.filter(
            (booking) => booking.status === PnrStatus.HELD,
          );

          if (toExpire.length === 0) {
            return;
          }

          yield* Effect.logInfo(
            `Found ${toExpire.length} bookings to expire (out of ${expiredBookings.length} total expired candidates)`,
          );

          yield* Effect.forEach(
            toExpire,
            (booking) =>
              Effect.gen(function* () {
                yield* unitOfWork.transaction(
                  Effect.gen(function* () {
                    // 1. Mark booking as expired
                    const updatedBooking = booking.markExpired();

                    // 2. Save updated booking
                    yield* bookingRepo.save(updatedBooking);

                    // 3. Release all seats for all segments
                    yield* Effect.forEach(
                      booking.segments,
                      (segment) =>
                        inventoryService.releaseSeats({
                          flightId: segment.flightId,
                          cabin: segment.cabin,
                          numberOfSeats: booking.passengers.length,
                        }),
                      { discard: true },
                    );
                  }),
                );

                yield* Effect.logInfo(
                  `Successfully cancelled expired booking ${booking.pnrCode}`,
                );
              }).pipe(
                Effect.catchAll((error) =>
                  Effect.logError(
                    `Failed to process expiration for booking ${booking.pnrCode}`,
                    error,
                  ),
                ),
              ),
            { concurrency: "inherit" },
          );
        }).pipe(
          Effect.catchAllCause((cause) =>
            Effect.logError(
              "Error during background expiration processing",
              cause,
            ),
          ),
        );

      const start = () =>
        processExpirations().pipe(
          Effect.repeat(Schedule.spaced(Duration.minutes(1))),
          Effect.zipRight(Effect.never),
          Effect.interruptible,
        );

      return {
        processExpirations,
        start,
      };
    }),
  );
}
