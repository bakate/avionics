import { type SqlClient, type SqlError } from "@effect/sql";
import { PgClient } from "@effect/sql-pg";
import { type ConfigError, type Layer } from "effect";

// Main Connection Layer (Production)
// Uses PostgreSQL standard environment variables (PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGSSLMODE)
// These are automatically picked up by the pg library
export const ConnectionPoolLive: Layer.Layer<
  SqlClient.SqlClient,
  ConfigError.ConfigError | SqlError.SqlError
> = PgClient.layer({
  // No config needed - pg will use PG* environment variables
});
