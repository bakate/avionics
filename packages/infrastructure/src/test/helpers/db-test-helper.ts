import { SqlClient, type SqlError } from "@effect/sql";
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
  const sql = yield* SqlClient.SqlClient;

  // Delete in correct order (respect foreign keys)
  yield* sql`DELETE FROM segments`;
  yield* sql`DELETE FROM passengers`;
  yield* sql`DELETE FROM bookings`;
  yield* sql`DELETE FROM event_outbox`;
  yield* sql`DELETE FROM flight_inventory`;
  yield* sql`DELETE FROM audit_log`;

  yield* Effect.logDebug("Database cleaned");
});

export type ValidTableName =
  | "segments"
  | "passengers"
  | "bookings"
  | "event_outbox"
  | "flight_inventory"
  | "audit_log";

/**
 * Count rows in a table (for verification)
 */
export const countRows = (tableName: ValidTableName) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const result = yield* sql<{ count: number }>`
      SELECT COUNT(*)::int as count
      FROM ${sql(tableName)}
    `;
    return result[0]?.count ?? 0;
  });
