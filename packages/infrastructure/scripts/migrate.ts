#!/usr/bin/env tsx
/**
 * Database migration runner (Drizzle)
 * Runs versioned migrations from drizzle/ folder
 */

import "dotenv/config";
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
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void runMigrations();
