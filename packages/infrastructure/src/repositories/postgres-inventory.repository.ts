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
      }).pipe(
        // Effect.catchTag("SqlError", ...) -> Wrap in PersistenceError if not found
        // But for found, we handle Not Found.
        Effect.mapError(
          (e) =>
            new InventoryPersistenceError({
              flightId: flightId,
              reason: (e as any).message || "Unknown error",
            }),
        ),
      );

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
            100, ${inventory.availability.economy.available},
            20, ${inventory.availability.business.available},
            8, ${inventory.availability.first.available},
            ${inventory.version}
          )
          ON CONFLICT (flight_id) DO UPDATE SET
            economy_available = EXCLUDED.economy_available,
            business_available = EXCLUDED.business_available,
            first_available = EXCLUDED.first_available,
            version = flight_inventory.version + 1
          WHERE flight_inventory.version = ${inventory.version - 1}
          RETURNING version
        `;

        if (result.length === 0) {
          // Conflict check failed (Version mismatch)
          // OR creation failed? (Should not happen with INSERT ON CONFLICT unless constraints)
          // Actually, if we INSERT new, version should be what we passed (1?)
          // If we UPDATE, we expect previous version.

          const existing = yield* sql<{
            version: number;
          }>`SELECT version FROM flight_inventory WHERE flight_id = ${inventory.flightId}`;
          const first = existing[0];
          const currentVersion =
            existing.length > 0 && first ? (first.version as number) : -1;

          if (currentVersion !== -1) {
            return yield* Effect.fail(
              new OptimisticLockingError({
                entityType: "FlightInventory",
                id: inventory.flightId,
                expectedVersion: inventory.version - 1,
                actualVersion: currentVersion,
              }),
            );
          }
          // Unknown error
          return yield* Effect.fail(new Error("Failed to save inventory"));
        }

        // Save Domain Events (Transactional Outbox)
        // Save Domain Events (Transactional Outbox)
        if (inventory.domainEvents.length > 0) {
          const events = inventory.domainEvents.map((e: any) => ({
            event_type: e._tag ?? e.constructor.name,
            aggregate_id: inventory.flightId,
            payload: e,
          }));

          yield* sql`
            INSERT INTO event_outbox (event_type, aggregate_id, payload)
            ${sql(events as any)}
          `;
        }

        return new FlightInventory({
          ...inventory,
          version: result[0]!.version as number,
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
