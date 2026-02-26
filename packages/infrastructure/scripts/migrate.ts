#!/usr/bin/env tsx
/**
 * Database migration runner (Drizzle)
 * Runs versioned migrations from drizzle/ folder
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import * as dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function runMigrations() {
  const pool = new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: process.env.PGSSLMODE === "require",
  });

  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: "./drizzle" });
  } catch (_error) {
    // biome-ignore lint/suspicious/noConsole: Migration script
    console.error("Migration failed:", _error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void runMigrations();
