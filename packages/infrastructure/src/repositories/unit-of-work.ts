import { SqlClient } from "@effect/sql";
import {
  UnitOfWork,
  type UnitOfWorkPort,
} from "@workspace/application/unit-of-work";
import { Effect, Layer } from "effect";

export class PostgresUnitOfWork {
  /**
   * Live Layer — PostgreSQL implementation.
   */
  static readonly Live = Layer.effect(
    UnitOfWork,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const transaction: UnitOfWorkPort["transaction"] = (effect) =>
        sql
          .withTransaction(effect)
          .pipe(
            Effect.tapError((err) =>
              Effect.logError("Transaction failed, rolling back", err),
            ),
          );

      return UnitOfWork.of({ transaction });
    }),
  );

  /**
   * Test Layer — No-op implementation for tests.
   */
  static readonly Test = (overrides: Partial<UnitOfWorkPort> = {}) =>
    Layer.succeed(
      UnitOfWork,
      UnitOfWork.of({
        transaction: (effect) => effect,
        ...overrides,
      }),
    );
}
