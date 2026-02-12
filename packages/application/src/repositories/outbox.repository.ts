import { type OutboxPersistenceError } from "@workspace/domain/errors";
import { Context, type Effect } from "effect";

export interface OutboxRepositoryPort {
  /**
   * Persist multiple domain events to the outbox table.
   * This should typically be called within a transaction.
   */
  persist(
    events: ReadonlyArray<unknown>,
  ): Effect.Effect<void, OutboxPersistenceError, never>;
}

export class OutboxRepository extends Context.Tag("OutboxRepository")<
  OutboxRepository,
  OutboxRepositoryPort
>() {}
