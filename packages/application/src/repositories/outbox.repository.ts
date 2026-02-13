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

  /**
   * Fetch unpublished events from the outbox.
   * Should use SKIP LOCKED to allow concurrent processors.
   */
  getUnpublishedEvents(limit: number): Effect.Effect<
    ReadonlyArray<{
      id: string;
      eventType: string;
      payload: unknown;
      retryCount: number;
    }>,
    OutboxPersistenceError,
    never
  >;

  /**
   * Mark events as successfully published.
   */
  markAsPublished(
    ids: ReadonlyArray<string>,
  ): Effect.Effect<void, OutboxPersistenceError, never>;

  /**
   * Mark an event as failed and increment retry count.
   */
  markAsFailed(
    id: string,
    error: string,
  ): Effect.Effect<void, OutboxPersistenceError, never>;
}

export class OutboxRepository extends Context.Tag("OutboxRepository")<
  OutboxRepository,
  OutboxRepositoryPort
>() {}
