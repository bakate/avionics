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
import * as Events from "@workspace/domain/events";
import { type DomainEventType } from "@workspace/domain/events";
import { FlightInventory } from "@workspace/domain/inventory";
import { Effect, Layer } from "effect";
import {
  type FlightInventoryRow,
  toDomain,
} from "./mappers/inventory.mapper.js";

const EVENT_TYPE_REGISTRY = new Map<unknown, string>([
  [Events.BookingCreated, "BookingCreated"],
  [Events.BookingConfirmed, "BookingConfirmed"],
  [Events.BookingCancelled, "BookingCancelled"],
  [Events.BookingExpired, "BookingExpired"],
  [Events.SeatsHeld, "SeatsHeld"],
  [Events.SeatsReleased, "SeatsReleased"],
]);

const getEventTag = (event: Events.DomainEventType): string => {
  if ("_tag" in event && typeof event._tag === "string") {
    return event._tag;
  }
  const tag = EVENT_TYPE_REGISTRY.get(event.constructor);
  if (tag) {
    return tag;
  }
  throw new Error(
    `Domain event ${event.constructor.name} has no stable _tag or registry entry. Minification will break this.`,
  );
};

/**
 * PostgreSQL implementation of the InventoryRepository.
 */
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

        const [row] = rows;
        if (!row) {
          return yield* Effect.fail(
            new FlightNotFoundError({ flightId: flightId }),
          );
        }
        return toDomain(row);
      });

    const save: InventoryRepositoryPort["save"] = (inventory) =>
      sql
        .withTransaction(
          Effect.gen(function* () {
            const result = yield* sql`
          INSERT INTO flight_inventory (
            flight_id,
            economy_total, economy_available, economy_price_amount, economy_price_currency,
            business_total, business_available, business_price_amount, business_price_currency,
            first_total, first_available, first_price_amount, first_price_currency,
            version
          ) VALUES (
            ${inventory.flightId},
            ${inventory.availability.economy.capacity}, ${inventory.availability.economy.available}, ${inventory.availability.economy.price.amount}, ${inventory.availability.economy.price.currency},
            ${inventory.availability.business.capacity}, ${inventory.availability.business.available}, ${inventory.availability.business.price.amount}, ${inventory.availability.business.price.currency},
            ${inventory.availability.first.capacity}, ${inventory.availability.first.available}, ${inventory.availability.first.price.amount}, ${inventory.availability.first.price.currency},
            ${inventory.version + 1}
          )
          ON CONFLICT (flight_id) DO UPDATE SET
            economy_available = EXCLUDED.economy_available,
            economy_price_amount = EXCLUDED.economy_price_amount,
            economy_price_currency = EXCLUDED.economy_price_currency,
            business_available = EXCLUDED.business_available,
            business_price_amount = EXCLUDED.business_price_amount,
            business_price_currency = EXCLUDED.business_price_currency,
            first_available = EXCLUDED.first_available,
            first_price_amount = EXCLUDED.first_price_amount,
            first_price_currency = EXCLUDED.first_price_currency,
            version = flight_inventory.version + 1
          WHERE flight_inventory.version = ${inventory.version}
          RETURNING version
        `;

            if (result.length === 0) {
              // If update failed due to WHERE clause, find the current version to report it
              const existing = yield* sql<{ version: number }>`
            SELECT version FROM flight_inventory WHERE flight_id = ${inventory.flightId}
          `;
              const firstExisting = existing[0];
              const actualVersion = firstExisting
                ? (firstExisting.version as number)
                : -1;

              return yield* Effect.fail(
                new OptimisticLockingError({
                  entityType: "FlightInventory",
                  id: inventory.flightId,
                  expectedVersion: inventory.version,
                  actualVersion: actualVersion,
                }),
              );
            }

            const resultRow = result[0];
            if (!resultRow) {
              return yield* Effect.fail(
                new InventoryPersistenceError({
                  flightId: inventory.flightId,
                  reason: "Update failed to return a result",
                }),
              );
            }

            const returnedVersion = resultRow.version as number;
            // Verify increment
            if (returnedVersion !== inventory.version + 1) {
              return yield* Effect.fail(
                new OptimisticLockingError({
                  entityType: "FlightInventory",
                  id: inventory.flightId,
                  expectedVersion: inventory.version,
                  actualVersion: returnedVersion - 1,
                }),
              );
            }

            // Save Domain Events (Transactional Outbox)
            if (inventory.domainEvents.length > 0) {
              const events = inventory.domainEvents.map(
                (e: DomainEventType) => ({
                  event_type: getEventTag(e),
                  aggregate_id: inventory.flightId,
                  payload: e,
                }),
              );

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
          }),
        )
        .pipe(
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
          const columnMap = {
            ECONOMY: "economy_available",
            BUSINESS: "business_available",
            FIRST: "first_available",
          } as const;

          const column = (columnMap as Record<string, string>)[cabin];

          if (!column) {
            return yield* Effect.fail(
              new InventoryPersistenceError({
                flightId: "all",
                reason: `Invalid cabin type: ${cabin}`,
              }),
            );
          }

          // Single dynamic query instead of branching
          const rows = yield* sql<FlightInventoryRow>`
            SELECT * FROM flight_inventory
            WHERE ${sql(column)} >= ${minSeats}
          `;

          return rows.map(toDomain);
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

/**
 * Test Layer — Mock implementation.
 */
export const PostgresInventoryRepositoryTest = (
  overrides: Partial<InventoryRepositoryPort> = {},
) =>
  Layer.succeed(
    InventoryRepository,
    InventoryRepository.of({
      save: (inventory) => Effect.succeed(inventory),
      getByFlightId: (flightId) =>
        Effect.fail(new FlightNotFoundError({ flightId })),
      findAvailableFlights: () => Effect.succeed([]),
      ...overrides,
    }),
  );
