import { BookingCancelled, BookingExpired } from "@workspace/domain/events";
import { Effect, Layer, Schema } from "effect";
import { EventBus } from "../ports/event-bus.js";
import { InventoryService } from "../services/inventory.service.js";

/**
 * Listener that reacts to Booking events and releases seats in inventory.
 * This avoids manual polling of the outbox table for inventory side-effects.
 */
export const InventoryReleaseListenerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const eventBus = yield* EventBus;
    const inventoryService = yield* InventoryService;

    yield* Effect.logInfo("Starting Inventory Release Listener");

    // Unified handler for events that contain segments to release
    const releaseSeats = (event: unknown) =>
      Effect.gen(function* () {
        // We only care about events with segments (Cancelled, Expired)
        if (isReleasableEvent(event)) {
          yield* Effect.forEach(
            event.segments,
            (segment) =>
              inventoryService
                .releaseSeats({
                  flightId: segment.flightId,
                  cabin: segment.cabin,
                  numberOfSeats: segment.quantity,
                })
                .pipe(
                  Effect.catchAll((err) =>
                    Effect.logWarning("Could not release segment in listener", {
                      bookingId: event.bookingId,
                      segment,
                      error: err,
                    }),
                  ),
                ),
            { discard: true },
          );

          yield* Effect.logInfo(
            `Released seats for booking ${event.bookingId}`,
            {
              type: event._tag,
            },
          );
        }
      }).pipe(
        Effect.catchAll((err) =>
          Effect.logError("Failed to release seats", {
            error: err,
            bookingId: isReleasableEvent(event) ? event.bookingId : "unknown",
          }),
        ),
      );

    // Subscribe to events that should trigger seat release
    yield* eventBus.subscribe("BookingCancelled", releaseSeats);
    yield* eventBus.subscribe("BookingExpired", releaseSeats);
  }),
);

// Type Guard for events containing segments to release
const ReleasableEventSchema = Schema.Union(BookingCancelled, BookingExpired);
type ReleasableEvent = typeof ReleasableEventSchema.Type;

const isReleasableEvent = Schema.is(ReleasableEventSchema) as (
  u: unknown,
) => u is ReleasableEvent;
