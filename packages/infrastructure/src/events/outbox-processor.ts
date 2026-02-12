import { SqlClient } from "@effect/sql";
import { OutboxConfig } from "@workspace/config";
import {
  Deferred,
  Duration,
  Effect,
  Fiber,
  Layer,
  Ref,
  Schedule,
} from "effect";
import { EventBus } from "./event-bus.js";

interface OutboxRow {
  readonly id: string;
  readonly event_type: string;
  readonly payload: unknown;
  readonly retry_count: number;
  readonly processing_at: Date | null;
}

const createRetrySchedule = (retryDelays: ReadonlyArray<number>) =>
  retryDelays.reduce(
    (schedule, delay) =>
      schedule === null
        ? Schedule.spaced(Duration.millis(delay)).pipe(
            Schedule.intersect(Schedule.recurs(1)),
          )
        : schedule.pipe(
            Schedule.andThen(
              Schedule.spaced(Duration.millis(delay)).pipe(
                Schedule.intersect(Schedule.recurs(1)),
              ),
            ),
          ),
    null as Schedule.Schedule<unknown, unknown, unknown> | null,
  ) ?? Schedule.stop;

export const createOutboxProcessorLive = (config: OutboxConfig) =>
  Layer.scopedDiscard(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const eventBus = yield* EventBus;

      const isShuttingDown = yield* Ref.make(false);
      const shutdownComplete = yield* Deferred.make<void>();
      const inFlightCount = yield* Ref.make(0);

      const retrySchedule = createRetrySchedule(config.retryDelays);

      const publishEvent = (row: OutboxRow) =>
        eventBus.publish(row.payload).pipe(
          Effect.retry(retrySchedule),
          Effect.matchEffect({
            onFailure: (error) =>
              Effect.gen(function* () {
                yield* sql`
                UPDATE event_outbox
                SET retry_count = COALESCE(retry_count, 0) + 1, last_error = ${String(error)}, processing_at = NULL
                WHERE id = ${row.id}
              `;
                yield* Effect.logError("Failed to publish event", {
                  eventId: row.id,
                  error,
                });
              }),
            onSuccess: () =>
              Effect.gen(function* () {
                yield* sql`
            UPDATE event_outbox
            SET published_at = NOW(), processing_at = NULL
            WHERE id = ${row.id}
          `.pipe(
                  Effect.catchAll((error) =>
                    Effect.logError("Failed to mark event as published", {
                      eventId: row.id,
                      error,
                    }),
                  ),
                );
                yield* Effect.logDebug("Event published", { eventId: row.id });
              }),
          }),
        );

      const processEvents = Effect.gen(function* () {
        // Phase 1: Fetch and reserve candidates (Short Transaction)
        const rows = yield* sql.withTransaction(
          Effect.gen(function* () {
            const candidates = yield* sql<OutboxRow>`
              SELECT id, event_type, payload, COALESCE(retry_count, 0) as retry_count
              FROM event_outbox
              WHERE published_at IS NULL
                AND (processing_at IS NULL OR processing_at < NOW() - INTERVAL '5 minutes')
                AND COALESCE(retry_count, 0) < ${config.maxRetries}
              ORDER BY created_at ASC
              LIMIT ${config.batchSize}
              FOR UPDATE SKIP LOCKED
            `;

            if (candidates.length === 0) return [];

            const ids = candidates.map((r) => r.id);
            yield* sql`
              UPDATE event_outbox
              SET processing_at = NOW()
              WHERE id = ANY(${ids})
            `;

            return candidates;
          }),
        );

        if (rows.length === 0) return;

        // Phase 2: Publish events (No Transaction)
        yield* Effect.logDebug(`Processing ${rows.length} outbox events`);
        yield* Effect.acquireUseRelease(
          Ref.update(inFlightCount, (count) => count + rows.length),
          () => Effect.all(rows.map(publishEvent), { concurrency: 10 }),
          () => Ref.update(inFlightCount, (count) => count - rows.length),
        );
      });

      const pollingLoop = Effect.gen(function* () {
        while (!(yield* Ref.get(isShuttingDown))) {
          yield* processEvents.pipe(
            Effect.catchAll((error) =>
              Effect.logError("Outbox processing error", {
                error: String(error),
              }),
            ),
          );
          yield* Effect.sleep(Duration.seconds(config.pollingInterval));
        }
      });

      yield* Effect.logInfo("Starting Outbox Processor...", {
        pollingInterval: config.pollingInterval,
        batchSize: config.batchSize,
        maxRetries: config.maxRetries,
      });

      const fiber = yield* Effect.forkScoped(pollingLoop);

      yield* Effect.addFinalizer(() =>
        Effect.gen(function* () {
          yield* Effect.logInfo("Shutting down Outbox Processor...");
          yield* Ref.set(isShuttingDown, true);

          yield* Effect.gen(function* () {
            while ((yield* Ref.get(inFlightCount)) > 0) {
              yield* Effect.logDebug("Waiting for in-flight events...", {
                inFlight: yield* Ref.get(inFlightCount),
              });
              yield* Effect.sleep(Duration.millis(100));
            }
          }).pipe(
            Effect.timeout(Duration.seconds(30)),
            Effect.orElse(() => Effect.void),
          );

          yield* Fiber.interrupt(fiber);
          yield* Deferred.succeed(shutdownComplete, undefined);
          yield* Effect.logInfo("Outbox Processor shutdown complete");
        }),
      );

      yield* Effect.logInfo("✓ Outbox Processor started");
    }),
  );

export const OutboxProcessorLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const config = yield* OutboxConfig;
    return yield* createOutboxProcessorLive(config).pipe(
      Layer.buildWithScope(yield* Effect.scope),
    );
  }),
);
