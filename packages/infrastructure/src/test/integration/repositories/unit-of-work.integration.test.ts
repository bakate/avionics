import { SqlClient } from "@effect/sql";
import { UnitOfWork } from "@workspace/application/unit-of-work";
import { Effect } from "effect";
import { beforeEach, describe, expect, it } from "vitest";
import { PostgresUnitOfWork } from "../../../repositories/unit-of-work.js";
import { cleanDatabase, TestLayer } from "../../helpers/db-test-helper.js";

describe("UnitOfWork Integration", () => {
  // Explicitly compose layers for test execution
  // 1. Provide UnitOfWork (needs SqlClient)
  // 2. Provide TestLayer (provides SqlClient)

  beforeEach(async () => {
    await Effect.runPromise(cleanDatabase.pipe(Effect.provide(TestLayer)));
  });

  const insertInventory = (sql: SqlClient.SqlClient, flightId: string) => sql`
  INSERT INTO flight_inventory (
                flight_id,
                economy_total, economy_available, economy_price_amount, economy_price_currency,
                business_total, business_available, business_price_amount, business_price_currency,
                first_total, first_available, first_price_amount, first_price_currency,
                version
            ) VALUES (${flightId},
            100, 100, 100.00, 'EUR', -- economy
            20, 20, 500.00, 'EUR', -- business
            10, 10, 1000.00, 'EUR', -- first
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
        Effect.provide(PostgresUnitOfWork.Live),
        Effect.provide(TestLayer),
      ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      flight_id: "FL-UOW-COMMIT",
      economy_total: 100,
      economy_available: 100,
      economy_price_amount: "100.00",
      economy_price_currency: "EUR",
      business_total: 20,
      business_available: 20,
      business_price_amount: "500.00",
      business_price_currency: "EUR",
      first_total: 10,
      first_available: 10,
      first_price_amount: "1000.00",
      first_price_currency: "EUR",
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
      program.pipe(
        Effect.provide(PostgresUnitOfWork.Live),
        Effect.provide(TestLayer),
      ),
    );
    expect(rows).toHaveLength(0);
  });
});
