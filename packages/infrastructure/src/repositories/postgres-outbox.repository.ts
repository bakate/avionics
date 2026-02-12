import { SqlClient } from "@effect/sql";
import { OutboxRepository } from "@workspace/application/outbox.repository";
import { OutboxPersistenceError } from "@workspace/domain/errors";
import { Effect, Layer } from "effect";

export const PostgresOutboxRepositoryLive = Layer.effect(
  OutboxRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return OutboxRepository.of({
      persist: (events) =>
        Effect.gen(function* () {
          if (events.length === 0) return;

          const values = events.map((event: any) => ({
            event_type: event._tag ?? event.constructor.name,
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
    });
  }),
);
