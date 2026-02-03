import { SqlClient } from "@effect/sql";
import { UnitOfWork } from "@workspace/application/unit-of-work";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UnitOfWorkLive } from "../../repositories/unit-of-work.js";
import { cleanDatabase, TestLayer } from "../helpers/db-test-helper.js";

describe("UnitOfWork Integration", () => {
  // Explicitly compose layers for test execution
  // 1. Provide UnitOfWork (needs SqlClient)
  // 2. Provide TestLayer (provides SqlClient)

  beforeEach(async () => {
    await Effect.runPromise(cleanDatabase.pipe(Effect.provide(TestLayer)));
  });

  afterEach(async () => {
    await Effect.runPromise(cleanDatabase.pipe(Effect.provide(TestLayer)));
  });

  const insertInventory = (sql: SqlClient.SqlClient, flightId: string) => sql`
  INSERT INTO flight_inventory (
                flight_id,
                economy_total, economy_available,
                business_total, business_available,
                first_total, first_available,
                version
            ) VALUES (${flightId},
            100, 100, -- economy (total, available)
            20, 20, -- business (total, available)
            10, 10, -- first (total, available)
            1 -- version
            )
`;

  it("should commit changes when transaction succeeds", async () => {
    const program = Effect.gen(function* () {
      const uow = yield* UnitOfWork;
      const sql = yield* SqlClient.SqlClient;

      yield* uow.transaction(
        Effect.gen(function* () {
          yield* insertInventory(sql, "FL-UOW-COMMIT");
        }),
      );

      // Verify persistence
      const rows =
        yield* sql`SELECT * FROM flight_inventory WHERE flight_id = 'FL-UOW-COMMIT'`;
      return rows;
    });

    const rows = await Effect.runPromise(
      program.pipe(
        Effect.provide(UnitOfWorkLive),
        Effect.provide(TestLayer),
      ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      flight_id: "FL-UOW-COMMIT",
      economy_total: 100,
      economy_available: 100,
      business_total: 20,
      business_available: 20,
      first_total: 10,
      first_available: 10,
      version: 1,
    });
  });

  it("should rollback changes when transaction fails", async () => {
    const program = Effect.gen(function* () {
      const uow = yield* UnitOfWork;
      const sql = yield* SqlClient.SqlClient;

      const task = uow.transaction(
        Effect.gen(function* () {
          // 1. Insert
          yield* insertInventory(sql, "FL-UOW-ROLLBACK");

          // 2. Fail
          return yield* Effect.fail(new Error("Boom"));
        }),
      );

      // Run and catch error to check DB state
      yield* Effect.either(task);

      // Verify rollback
      return yield* sql`SELECT * FROM flight_inventory WHERE flight_id = 'FL-UOW-ROLLBACK'`;
    });

    const rows = await Effect.runPromise(
      program.pipe(Effect.provide(UnitOfWorkLive), Effect.provide(TestLayer)),
    );
    expect(rows).toHaveLength(0);
  });
});
