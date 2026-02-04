import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Effect } from "effect";
import { Pool } from "pg";

export class DrizzleMigrator extends Effect.Service<DrizzleMigrator>()(
  "DrizzleMigrator",
  {
    effect: Effect.gen(function* () {
      const acquire = Effect.sync(
        () =>
          new Pool({
            host: process.env.PGHOST,
            port: Number(process.env.PGPORT),
            user: process.env.PGUSER,
            password: process.env.PGPASSWORD,
            database: process.env.PGDATABASE,
            ssl: process.env.PGSSLMODE === "require",
          }),
      );

      const use = (pool: Pool) =>
        Effect.gen(function* () {
          const db = drizzle(pool);
          yield* Effect.tryPromise({
            try: () => migrate(db, { migrationsFolder: "./drizzle" }),
            catch: (error) => new Error(`Migration failed: ${error}`),
          });
          yield* Effect.logInfo("Drizzle migrations applied successfully");
        });

      const release = (pool: Pool) => Effect.promise(() => pool.end());

      return {
        run: Effect.acquireUseRelease(acquire, use, release),
      };
    }),
  },
) {}
