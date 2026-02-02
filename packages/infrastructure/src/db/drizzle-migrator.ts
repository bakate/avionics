import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Effect } from "effect";
import { Pool } from "pg";

export class DrizzleMigrator extends Effect.Service<DrizzleMigrator>()(
  "DrizzleMigrator",
  {
    effect: Effect.gen(function* () {
      return {
        run: Effect.gen(function* () {
          const pool = new Pool({
            host: process.env.PGHOST,
            port: Number(process.env.PGPORT),
            user: process.env.PGUSER,
            password: process.env.PGPASSWORD,
            database: process.env.PGDATABASE,
            ssl: process.env.PGSSLMODE === "require",
          });

          const db = drizzle(pool);

          yield* Effect.tryPromise({
            try: () => migrate(db, { migrationsFolder: "./drizzle" }),
            catch: (error) => new Error(`Migration failed: ${error}`),
          });

          yield* Effect.promise(() => pool.end());
          yield* Effect.logInfo("Drizzle migrations applied successfully");
        }),
      };
    }),
  },
) {}
