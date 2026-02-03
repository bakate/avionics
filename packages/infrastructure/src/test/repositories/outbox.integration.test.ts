import { SqlClient } from "@effect/sql";
import { InventoryRepository } from "@workspace/application/inventory.repository";
import { SeatsHeld } from "@workspace/domain/events";
import { FlightId } from "@workspace/domain/kernel";
import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PostgresInventoryRepositoryLive } from "../../repositories/postgres-inventory.repository.js";
import { createTestInventory } from "../factories/inventory-factory.js";
import { cleanDatabase, TestLayer } from "../helpers/db-test-helper.js";

describe("Transactional Outbox Integration", () => {
  beforeEach(async () => {
    await Effect.runPromise(cleanDatabase.pipe(Effect.provide(TestLayer)));
  });

  afterEach(async () => {
    await Effect.runPromise(cleanDatabase.pipe(Effect.provide(TestLayer)));
  });

  it("should save domain events to the outbox table when persisting an aggregate", async () => {
    const flightId = "FL-OUTBOX-1";

    // Create inventory with a domain event
    const inventory = createTestInventory({
      flightId,
    });

    const program = Effect.gen(function* () {
      const repo = yield* InventoryRepository;
      const sql = yield* SqlClient.SqlClient;

      // holdSeats returns [nextInventory, price]
      const [updatedInventory] = yield* inventory.holdSeats("ECONOMY", 2);

      // Save inventory including the new event
      yield* repo.save(updatedInventory);

      // Verify immediate persistence in outbox
      return yield* sql`SELECT * FROM event_outbox WHERE aggregate_id = ${flightId}`;
    });

    const rows = await Effect.runPromise(
      program.pipe(
        Effect.provide(PostgresInventoryRepositoryLive),
        Effect.provide(TestLayer),
      ),
    );

    expect(rows).toHaveLength(1);

    // Cast to expected shape for assertions (safe since we just asserted length)
    interface OutboxRow {
      event_type: string;
      aggregate_id: string;
      published_at: Date | null;
      payload: unknown;
    }
    const row = rows[0] as unknown as OutboxRow;

    expect(row.event_type).toBe("SeatsHeld");
    expect(row.aggregate_id).toBe(flightId);
    expect(row.published_at).toBeNull();

    // Verify payload using Schema (strict typing)
    const payload = row.payload;

    // Validate that payload matches the SeatsHeld schema
    // This throws if payload is invalid, serving as an assertion
    const decodedEvent = Schema.decodeUnknownSync(SeatsHeld)(payload);

    expect(decodedEvent.quantity).toBe(2);
    expect(decodedEvent.cabin).toBe("ECONOMY");
  });
});
