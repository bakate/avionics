import { PgClient } from "@effect/sql-pg";
import { Layer } from "effect";

// Main Connection Layer (Production)
// Uses PostgreSQL standard environment variables (PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGSSLMODE)
// These are automatically picked up by the pg library
export const ConnectionPoolLive = PgClient.layer({
  // No config needed - pg will use PG* environment variables
});
