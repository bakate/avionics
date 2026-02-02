import { SqlClient } from "@effect/sql";
import { Duration, Effect, Layer, Schedule } from "effect";
import { EventBus } from "./event-bus.js";

// Polling Interval
const POLLING_INTERVAL = Duration.millis(5000);

// Basic Outbox Worker
export const TransactionalOutboxLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const eventBus = yield* EventBus;

    const processEvents = Effect.gen(function* () {
      // Fetch unpublished events
      const rows = yield* sql`
                SELECT id, event_type, payload FROM event_outbox
                WHERE published_at IS NULL
                ORDER BY created_at ASC
                LIMIT 50
            `;

      if (rows.length === 0) return;

      yield* Effect.logDebug(`Processing ${rows.length} outbox events`);

      // Publish to Bus
      for (const row of rows) {
        // Parse payload (assuming JSONB)
        // In Postgres adapter, payload might be an object already or string depending on driver config
        const payload = row.payload;
        try {
          // Try publish
          yield* eventBus.publish(payload);

          // Mark published
          yield* sql`
                        UPDATE event_outbox
                        SET published_at = NOW()
                        WHERE id = ${row.id}
                    `;
        } catch (e) {
          yield* Effect.logError("Failed to publish outbox event", e);
          // Do not mark as published -> will retry next tick
        }
      }
    });

    // Run forever
    yield* Effect.repeat(
      processEvents.pipe(
        Effect.catchAll((e) => Effect.logError("Outbox Worker Error", e)),
      ),
      Schedule.spaced(POLLING_INTERVAL),
    );
  }),
);
