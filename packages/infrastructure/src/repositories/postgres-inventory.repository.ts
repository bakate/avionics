import { SqlClient } from "@effect/sql";
import {
  InventoryRepository,
  type InventoryRepositoryPort,
} from "@workspace/application/inventory.repository";
import {
  FlightNotFoundError,
  InventoryPersistenceError,
  OptimisticLockingError,
} from "@workspace/domain/errors";
import { FlightInventory } from "@workspace/domain/inventory";
import { Effect, Layer } from "effect";
import { type FlightInventoryRow, toDomain } from "./mappers/inventory.mapper";

export const PostgresInventoryRepositoryLive = Layer.effect(
  InventoryRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const findByFlightId: InventoryRepositoryPort["getByFlightId"] = (
      flightId,
    ) =>
      Effect.gen(function* () {
        const rows = yield* sql<FlightInventoryRow>`
          SELECT * FROM flight_inventory
          WHERE flight_id = ${flightId}
        `.pipe(
          Effect.catchTag("SqlError", (e) =>
            Effect.fail(
              new InventoryPersistenceError({
                flightId: flightId,
                reason: e.message,
              }),
            ),
          ),
        );

        if (rows.length === 0) {
          return yield* Effect.fail(
            new FlightNotFoundError({ flightId: flightId }),
          );
        }

        return toDomain(rows[0]!);
      });

    const save: InventoryRepositoryPort["save"] = (inventory) =>
      Effect.gen(function* () {
        const result = yield* sql`
          INSERT INTO flight_inventory (
            flight_id,
            economy_total, economy_available,
            business_total, business_available,
            first_total, first_available,
            version
          ) VALUES (
            ${inventory.flightId},
            ${inventory.availability.economy.capacity}, ${inventory.availability.economy.available},
            ${inventory.availability.business.capacity}, ${inventory.availability.business.available},
            ${inventory.availability.first.capacity}, ${inventory.availability.first.available},
            1
          )
          ON CONFLICT (flight_id) DO UPDATE SET
            economy_available = EXCLUDED.economy_available,
            business_available = EXCLUDED.business_available,
            first_available = EXCLUDED.first_available,
            version = flight_inventory.version + 1
          RETURNING flight_inventory.version
        `;

        const row = result[0];
        if (!row) {
          return yield* Effect.fail(new Error("Failed to save inventory"));
        }

        const returnedVersion = row.version as number;

        // Optimistic locking check for UPDATEs only
        // If returnedVersion is 1, it was an INSERT (no conflict)
        // If returnedVersion > 1, it was an UPDATE - check version matches
        if (returnedVersion > 1 && returnedVersion !== inventory.version) {
          return yield* Effect.fail(
            new OptimisticLockingError({
              entityType: "FlightInventory",
              id: inventory.flightId,
              expectedVersion: inventory.version - 1,
              actualVersion: returnedVersion - 1,
            }),
          );
        }

        // Save Domain Events (Transactional Outbox)
        if (inventory.domainEvents.length > 0) {
          const events = inventory.domainEvents.map((e: any) => ({
            event_type: e._tag ?? e.constructor.name,
            aggregate_id: inventory.flightId,
            payload: e,
          }));

          // Batch insert events
          for (const event of events) {
            yield* sql`
              INSERT INTO event_outbox (event_type, aggregate_id, payload)
              VALUES (${event.event_type}, ${event.aggregate_id}, ${JSON.stringify(event.payload)})
            `;
          }
        }

        return new FlightInventory({
          ...inventory,
          version: returnedVersion,
        }).clearEvents();
      }).pipe(
        Effect.mapError((e) => {
          if (e instanceof OptimisticLockingError) return e;
          return new InventoryPersistenceError({
            flightId: inventory.flightId,
            reason: (e as any).message || "Unknown error",
          });
        }),
      );

    return {
      save,
      getByFlightId: findByFlightId,
      findAvailableFlights: (cabin, minSeats) =>
        Effect.gen(function* () {
          // Dynamic query based on cabin
          let rows: readonly FlightInventoryRow[];
          if (cabin === "ECONOMY") {
            rows = yield* sql<FlightInventoryRow>`
               SELECT * FROM flight_inventory WHERE economy_available >= ${minSeats}
             `;
          } else if (cabin === "BUSINESS") {
            rows = yield* sql<FlightInventoryRow>`
               SELECT * FROM flight_inventory WHERE business_available >= ${minSeats}
             `;
          } else if (cabin === "FIRST") {
            rows = yield* sql<FlightInventoryRow>`
               SELECT * FROM flight_inventory WHERE first_available >= ${minSeats}
             `;
          } else {
            rows = [];
          }

          if (rows === undefined) {
            // Should verify why rows could be undefined if sql returns []
            // Actually, the above If-Else guarantees rows assignment unless initialized
            // but let's be safe
            rows = [];
          }

          return rows.map(toDomain);
        }).pipe(Effect.catchTag("SqlError", (e) => Effect.die(e))),
    };
  }),
);
