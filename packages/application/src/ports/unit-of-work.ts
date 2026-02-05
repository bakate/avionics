/**
 * @file unit-of-work.ts
 * @module @workspace/application/ports
 * @description Unit of Work pattern for transactional boundaries
 */

import { Context, type Effect } from "effect";

/**
 * UnitOfWork provides transactional boundaries for operations
 * that need to be atomic (all-or-nothing).
 *
 * Infrastructure implementations will handle:
 * - Database transactions
 * - Event publishing (transactional outbox pattern)
 * - Rollback on failure
 */
export interface UnitOfWorkPort {
  /**
   * Execute an effect within a transaction.
   * If the effect fails, all changes are rolled back.
   * If the effect succeeds, all changes are committed.
   */
  readonly transaction: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E | { readonly _tag: "SqlError" }, R>;
}

export class UnitOfWork extends Context.Tag("UnitOfWork")<
  UnitOfWork,
  UnitOfWorkPort
>() {}
