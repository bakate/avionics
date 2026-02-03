import type { SqlClient, SqlError } from "@effect/sql";
import { PgClient } from "@effect/sql-pg";
import { type ConfigError, Effect, type Layer } from "effect";
import { ConnectionPoolLive } from "../../db/connection.js";

export const TestLayer: Layer.Layer<
  SqlClient.SqlClient,
  ConfigError.ConfigError | SqlError.SqlError
> = ConnectionPoolLive;

/**
 * Clean all tables in the database
 * Deletes in correct order to respect foreign key constraints
 */
export const cleanDatabase = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient;

  // Delete in correct order (respect foreign keys)
  yield* sql`DELETE FROM segments`;
  yield* sql`DELETE FROM passengers`;
  yield* sql`DELETE FROM bookings`;
  yield* sql`DELETE FROM event_outbox`;
  yield* sql`DELETE FROM flight_inventory`;
  yield* sql`DELETE FROM audit_log`;

  yield* Effect.logDebug("Database cleaned");
});

/**
 * Count rows in a table (for verification)
 */
export const countRows = (tableName: string) =>
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient;
    const result = yield* sql<{ count: number }>`
      SELECT COUNT(*)::int as count
      FROM ${sql(tableName)}
    `;
    return result[0]?.count ?? 0;
  });
