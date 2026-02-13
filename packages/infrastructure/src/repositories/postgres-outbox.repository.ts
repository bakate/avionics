import { SqlClient } from "@effect/sql";
import { OutboxRepository } from "@workspace/application/outbox.repository";
import { OutboxPersistenceError } from "@workspace/domain/errors";
import { type DomainEventType } from "@workspace/domain/events";
import { Effect, Layer } from "effect";

export const PostgresOutboxRepositoryLive = Layer.effect(
  OutboxRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return OutboxRepository.of({
      persist: (events: ReadonlyArray<DomainEventType>) =>
        Effect.gen(function* () {
          if (events.length === 0) return;

          const values = events.map((event) => ({
            event_type: event._tag,
            payload: JSON.stringify(event),
          }));

          yield* sql`
            INSERT INTO event_outbox ${sql.insert(values)}
          `.pipe(
            Effect.mapError(
              (error) =>
                new OutboxPersistenceError({
                  cause: error.message,
                }),
            ),
          );
        }),

      getUnpublishedEvents: (limit) =>
        Effect.gen(function* () {
          const rows = yield* sql<{
            id: string;
            event_type: string;
            payload: unknown;
            retry_count: number;
          }>`
            SELECT id, event_type, payload, retry_count
            FROM event_outbox
            WHERE published_at IS NULL
            AND retry_count < 5
            ORDER BY created_at ASC
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
          `.pipe(
            Effect.mapError(
              (error) =>
                new OutboxPersistenceError({
                  cause: error.message,
                }),
            ),
          );

          return rows.map((row) => ({
            id: row.id,
            eventType: row.event_type,
            payload: row.payload,
            retryCount: row.retry_count,
          }));
        }),

      markAsPublished: (ids) =>
        Effect.gen(function* () {
          if (ids.length === 0) return;

          yield* sql`
            UPDATE event_outbox
            SET published_at = NOW()
            WHERE id IN ${sql.in(ids)}
          `.pipe(
            Effect.mapError(
              (error) =>
                new OutboxPersistenceError({
                  cause: error.message,
                }),
            ),
          );
        }),

      markAsFailed: (id, error) =>
        Effect.gen(function* () {
          yield* sql`
            UPDATE event_outbox
            SET retry_count = retry_count + 1, last_error = ${error}
            WHERE id = ${id}
          `.pipe(
            Effect.mapError(
              (err) =>
                new OutboxPersistenceError({
                  cause: err.message,
                }),
            ),
          );
        }),
    });
  }),
);
