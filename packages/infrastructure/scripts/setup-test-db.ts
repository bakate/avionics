#!/usr/bin/env tsx

/**
 * Setup test database
 * Applies migrations to the test database (Docker or Neon)
 *
 * Usage:
 *   pnpm test:setup
 *
 * Environment:
 *   Reads from .env.test (loaded by vitest.config.ts)
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Config, Console, Data, Effect, Redacted, Schedule } from "effect";
import pg from "pg";

// --- Setup environment ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, "../.env.test") });

// --- Domain Errors ---
class DbSetupError extends Data.TaggedError("DbSetupError")<{
  readonly message: string;
  readonly cause: unknown;
}> {}

/**
 * Test DB Configuration
 * Note: We map standard PG_* env vars here to stay compatible with
 * existing .env.test and Docker defaults.
 */
const testDbConfig = Config.all({
  host: Config.string("PGHOST").pipe(Config.withDefault("localhost")),
  port: Config.number("PGPORT").pipe(Config.withDefault(5433)),
  user: Config.string("PGUSER").pipe(Config.withDefault("postgres")),
  password: Config.redacted("PGPASSWORD").pipe(
    Config.withDefault(Redacted.make("postgres")),
  ),
  database: Config.string("PGDATABASE").pipe(
    Config.withDefault("avionics_test"),
  ),
  ssl: Config.string("PGSSLMODE").pipe(
    Config.map((mode) => mode === "require"),
    Config.withDefault("disable"),
  ),
});

// --- Database Connection Utility ---
const makePgClient = (configOverride: Partial<pg.ClientConfig> = {}) =>
  Effect.gen(function* () {
    const baseConfig = yield* testDbConfig;

    const client = new pg.Client({
      host: baseConfig.host,
      port: baseConfig.port,
      user: baseConfig.user,
      password: Redacted.value(baseConfig.password),
      ssl: baseConfig.ssl ? { rejectUnauthorized: false } : false,
      ...configOverride,
    });

    return yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => client.connect().then(() => client),
        catch: (e) =>
          new DbSetupError({
            message: "Failed to connect to Postgres",
            cause: e,
          }),
      }),
      (connectedClient) => Effect.promise(() => connectedClient.end()),
    );
  });

// --- Sub-programs ---
const ensureDatabaseExists = (dbName: string) =>
  Effect.gen(function* () {
    // Connect to 'postgres' default DB to perform maintenance
    const client = yield* makePgClient({ database: "postgres" });

    yield* Console.log(`Ensuring database "${dbName}" exists...`);
    const result = yield* Effect.tryPromise({
      try: () =>
        client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]),
      catch: (e) =>
        new DbSetupError({ message: "Query database failed", cause: e }),
    });

    if (result.rows.length === 0) {
      yield* Console.log(`Creating database "${dbName}"...`);
      yield* Effect.tryPromise({
        try: () => client.query(`CREATE DATABASE "${dbName}"`),
        catch: (e) =>
          new DbSetupError({
            message: `Database creation failed: ${dbName}`,
            cause: e,
          }),
      });
    } else {
      yield* Console.log(`Database "${dbName}" already exists.`);
    }
  });

const runMigrations = (dbName: string) =>
  Effect.gen(function* () {
    const client = yield* makePgClient({ database: dbName });
    const db = drizzle(client);

    yield* Console.log("Applying migrations...");
    yield* Effect.tryPromise({
      try: () =>
        migrate(db, {
          migrationsFolder: path.resolve(__dirname, "../drizzle"),
        }),
      catch: (e) =>
        new DbSetupError({ message: "Drizzle migrations failed", cause: e }),
    });
  });

// --- Orchestrator ---
const setup = Effect.gen(function* () {
  const cfg = yield* testDbConfig;
  const isDocker = cfg.host === "127.0.0.1" || cfg.host === "localhost";

  yield* Console.log(
    `Setting up test database: ${cfg.database} on ${cfg.host}`,
  );

  if (isDocker) {
    yield* Console.log("Docker detected, running pre-check...");
    // Retry connection logic for cold starts (5 retries max)
    yield* ensureDatabaseExists(cfg.database).pipe(
      Effect.retry(
        Schedule.exponential(200).pipe(Schedule.compose(Schedule.recurs(5))),
      ),
    );
  }

  yield* runMigrations(cfg.database);
  yield* Console.log("✅ Test database setup complete!");
}).pipe(
  Effect.scoped, // Handles client release
  Effect.catchAll((err) =>
    Console.error(`❌ Setup failed:`, err).pipe(
      Effect.andThen(Effect.fail(err)),
    ),
  ),
);

// Execution
Effect.runPromise(setup).catch(() => process.exit(1));
