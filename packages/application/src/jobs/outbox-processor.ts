import { Duration, Effect, Layer, Schedule } from "effect";
import { OutboxRepository } from "../repositories/outbox.repository.js";
import { InventoryService } from "../services/inventory.service.js";

export const OutboxProcessorLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const outboxRepo = yield* OutboxRepository;
    const inventoryService = yield* InventoryService;

    yield* Effect.logInfo("Starting Outbox Processor");

    const processEvents = Effect.gen(function* () {
      const events = yield* outboxRepo.getUnpublishedEvents(50);
      if (events.length === 0) return;

      yield* Effect.logDebug(`Processing ${events.length} outbox events`);

      for (const event of events) {
        yield* Effect.gen(function* () {
          const payload =
            typeof event.payload === "string"
              ? JSON.parse(event.payload)
              : event.payload;

          // Dispatch logic
          if (event.eventType === "BookingCancelled") {
            // Validate payload schema if needed, or cast since we trust the DB
            // We cast to any first because JSON.parse returns any
            const domainEvent = payload as any;
            if (domainEvent.segments) {
              yield* Effect.forEach(
                domainEvent.segments,
                (segment: any) =>
                  inventoryService.releaseSeats({
                    flightId: segment.flightId,
                    cabin: segment.cabin,
                    numberOfSeats: segment.quantity,
                  }),
                { discard: true },
              );
              yield* Effect.logInfo(`Released seats for cancelled booking`, {
                bookingId: domainEvent.bookingId,
              });
            }
          } else if (event.eventType === "BookingExpired") {
            const domainEvent = payload as any;
            if (domainEvent.segments) {
              yield* Effect.forEach(
                domainEvent.segments,
                (segment: any) =>
                  inventoryService.releaseSeats({
                    flightId: segment.flightId,
                    cabin: segment.cabin,
                    numberOfSeats: segment.quantity,
                  }),
                { discard: true },
              );
              yield* Effect.logInfo(`Released seats for expired booking`, {
                bookingId: domainEvent.bookingId,
              });
            }
          } else {
            yield* Effect.logWarning(
              `Skipping unknown event type: ${event.eventType}`,
              {
                eventId: event.id,
                eventType: event.eventType,
              },
            );
            return;
          }

          // Mark as processed
          yield* outboxRepo.markAsPublished([event.id]);
        }).pipe(
          Effect.catchAll((err) =>
            outboxRepo
              .markAsFailed(event.id, String(err))
              .pipe(
                Effect.tap(() =>
                  Effect.logError(`Failed to process event ${event.id}`, err),
                ),
              ),
          ),
        );
      }
    });

    // Run periodically
    yield* processEvents.pipe(
      Effect.repeat(Schedule.spaced(Duration.millis(1000))),
      Effect.fork,
    );
  }),
);
