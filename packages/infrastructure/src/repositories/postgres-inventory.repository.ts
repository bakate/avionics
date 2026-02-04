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
import type { DomainEventType } from "@workspace/domain/events";
import { FlightInventory } from "@workspace/domain/inventory";
import { Effect, Layer } from "effect";
import {
  type FlightInventoryRow,
  toDomain,
} from "./mappers/inventory.mapper.js";

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
          WHERE flight_inventory.version = ${inventory.version}
          RETURNING version
        `;

        if (result.length === 0) {
          // If update failed due to WHERE clause, find the current version to report it
          const existing = yield* sql<{ version: number }>`
            SELECT version FROM flight_inventory WHERE flight_id = ${inventory.flightId}
          `;
          const actualVersion =
            existing.length > 0 ? (existing[0]!.version as number) : -1;

          return yield* Effect.fail(
            new OptimisticLockingError({
              entityType: "FlightInventory",
              id: inventory.flightId,
              expectedVersion: inventory.version,
              actualVersion: actualVersion,
            }),
          );
        }

        // Save Domain Events (Transactional Outbox)
        if (inventory.domainEvents.length > 0) {
          const events = inventory.domainEvents.map((e: DomainEventType) => ({
            event_type: "_tag" in e ? String(e._tag) : e.constructor.name,
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
          version: result[0]!.version as number,
        }).clearEvents();
      }).pipe(
        Effect.mapError((e) => {
          if (e instanceof OptimisticLockingError) return e;
          return new InventoryPersistenceError({
            flightId: inventory.flightId,
            reason: e instanceof Error ? e.message : String(e),
          });
        }),
      );

    return {
      save,
      getByFlightId: findByFlightId,
      findAvailableFlights: (cabin, minSeats) =>
        Effect.gen(function* () {
          // Dynamic query based on cabin
          let rows: readonly FlightInventoryRow[] = [];

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
          }

          return rows.map((row) => toDomain(row));
        }).pipe(
          Effect.catchTag("SqlError", (e) =>
            Effect.fail(
              new InventoryPersistenceError({
                flightId: "all",
                reason: e.message,
              }),
            ),
          ),
        ),
    };
  }),
);
