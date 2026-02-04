import { SqlClient } from "@effect/sql";
import { Duration, Effect, Layer, Schedule } from "effect";
import { EventBus } from "./event-bus.js";

// Polling Interval
const POLLING_INTERVAL = Duration.millis(5000);

// Basic Outbox Worker
export const TransactionalOutboxLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const eventBus = yield* EventBus;

    const processEvents = sql.withTransaction(
      Effect.gen(function* () {
        // Fetch unpublished events with row-level locking to prevent concurrent processing
        const rows = yield* sql`
          SELECT id, event_type, payload FROM event_outbox
          WHERE published_at IS NULL
          ORDER BY created_at ASC
          LIMIT 50
          FOR UPDATE SKIP LOCKED
        `;

        if (rows.length === 0) return;

        yield* Effect.logDebug(`Processing ${rows.length} outbox events`);

        // Publish to Bus
        for (const row of rows) {
          const payload = row.payload;

          yield* eventBus.publish(payload).pipe(
            Effect.flatMap(
              () =>
                // Mark published
                sql`
                UPDATE event_outbox
                SET published_at = NOW()
                WHERE id = ${row.id}
              `,
            ),
            Effect.catchAll((e) =>
              Effect.logError("Failed to publish outbox event", e),
            ),
          );
        }
      }),
    );

    yield* Effect.logInfo("Starting Transactional Outbox Worker...");

    // Run forever in background
    yield* Effect.repeat(
      processEvents.pipe(
        Effect.catchAll((e) => Effect.logError("Outbox Worker Error", e)),
      ),
      Schedule.spaced(POLLING_INTERVAL),
    ).pipe(Effect.forkDaemon);

    yield* Effect.logInfo("✓ Transactional Outbox Worker started");
  }),
);
