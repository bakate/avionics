import { SqlClient } from "@effect/sql";
import {
  UnitOfWork,
  type UnitOfWorkPort,
} from "@workspace/application/unit-of-work";
import { Effect, Layer } from "effect";

export const UnitOfWorkLive: Layer.Layer<
  UnitOfWork,
  never,
  SqlClient.SqlClient
> = Layer.effect(
  UnitOfWork,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const transaction: UnitOfWorkPort["transaction"] = (effect) =>
      sql.withTransaction(effect).pipe(
        Effect.catchTag("SqlError", (err) => Effect.die(err)),
        Effect.tapError((err) =>
          Effect.logError("Transaction failed, rolling back", err),
        ),
      );

    return UnitOfWork.of({ transaction });
  }),
);
