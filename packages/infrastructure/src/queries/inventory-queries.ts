/**
 * @file inventory-queries.ts
 * @module @workspace/infrastructure/queries
 * @description CQRS read-side implementation for inventory queries
 */

import { SqlClient } from "@effect/sql";
import {
  InventoryQueries,
  type InventoryQueriesPort,
} from "@workspace/application/inventory-queries";
import {
  CabinAvailability,
  FlightAvailability,
} from "@workspace/application/read-models";
import { FlightNotFoundError } from "@workspace/domain/errors";
import { Effect, Layer } from "effect";
import { PersistenceError } from "../errors.js";

// Database row types for queries
interface FlightAvailabilityRow {
  flight_id: string;
  economy_available: number;
  business_available: number;
  first_available: number;
  economy_price_amount: string;
  economy_price_currency: string;
  business_price_amount: string;
  business_price_currency: string;
  first_price_amount: string;
  first_price_currency: string;
  last_updated: Date;
}

interface CabinAvailabilityRow {
  cabin: string;
  available: number;
  capacity: number;
  price_amount: string;
  price_currency: string;
  utilization_percent: number;
}

interface InventoryStatsRow {
  total_flights: number;
  total_seats_available: number;
  average_utilization: number;
  full_flights: number;
}

export const InventoryQueriesLive = Layer.effect(
  InventoryQueries,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const getFlightAvailability: InventoryQueriesPort["getFlightAvailability"] =
      (flightId) =>
        Effect.gen(function* () {
          const rows = yield* sql<FlightAvailabilityRow>`
            SELECT
              flight_id,
              economy_available,
              business_available,
              first_available,
              economy_price_amount,
              economy_price_currency,
              business_price_amount,
              business_price_currency,
              first_price_amount,
              first_price_currency,
              NOW() as last_updated
            FROM flight_inventory
            WHERE flight_id = ${flightId}
          `;

          const row = rows[0];
          if (!row) {
            return yield* Effect.fail(new FlightNotFoundError({ flightId }));
          }

          return new FlightAvailability({
            flightId: row.flight_id,
            economyAvailable: row.economy_available,
            businessAvailable: row.business_available,
            firstAvailable: row.first_available,
            economyPrice: {
              amount: Number.parseFloat(row.economy_price_amount),
              currency: row.economy_price_currency,
            },
            businessPrice: {
              amount: Number.parseFloat(row.business_price_amount),
              currency: row.business_price_currency,
            },
            firstPrice: {
              amount: Number.parseFloat(row.first_price_amount),
              currency: row.first_price_currency,
            },
            lastUpdated: row.last_updated,
          });
        }).pipe(
          Effect.catchTag("SqlError", (e) =>
            Effect.fail(
              new PersistenceError({
                message: `Failed to get flight availability: ${e.message}`,
                cause: e,
                timestamp: new Date(),
              }),
            ),
          ),
        );

    const getCabinAvailability: InventoryQueriesPort["getCabinAvailability"] = (
      flightId,
      cabin,
    ) =>
      Effect.gen(function* () {
        // Map cabin name to database columns
        const cabinLower = cabin.toLowerCase();

        if (cabinLower === "economy") {
          const rows = yield* sql<CabinAvailabilityRow>`
            SELECT
              'economy' as cabin,
              economy_available as available,
              economy_total as capacity,
              economy_price_amount as price_amount,
              economy_price_currency as price_currency,
              ROUND(((economy_total - economy_available)::numeric / economy_total::numeric) * 100, 2) as utilization_percent
            FROM flight_inventory
            WHERE flight_id = ${flightId}
          `;

          const row = rows[0];
          if (!row) {
            return yield* Effect.fail(new FlightNotFoundError({ flightId }));
          }

          return new CabinAvailability({
            cabin: row.cabin,
            available: row.available,
            capacity: row.capacity,
            price: {
              amount: Number.parseFloat(row.price_amount),
              currency: row.price_currency,
            },
            utilizationPercent: row.utilization_percent,
          });
        } else if (cabinLower === "business") {
          const rows = yield* sql<CabinAvailabilityRow>`
            SELECT
              'business' as cabin,
              business_available as available,
              business_total as capacity,
              business_price_amount as price_amount,
              business_price_currency as price_currency,
              ROUND(((business_total - business_available)::numeric / business_total::numeric) * 100, 2) as utilization_percent
            FROM flight_inventory
            WHERE flight_id = ${flightId}
          `;

          const row = rows[0];
          if (!row) {
            return yield* Effect.fail(new FlightNotFoundError({ flightId }));
          }

          return new CabinAvailability({
            cabin: row.cabin,
            available: row.available,
            capacity: row.capacity,
            price: {
              amount: Number.parseFloat(row.price_amount),
              currency: row.price_currency,
            },
            utilizationPercent: row.utilization_percent,
          });
        } else if (cabinLower === "first") {
          const rows = yield* sql<CabinAvailabilityRow>`
            SELECT
              'first' as cabin,
              first_available as available,
              first_total as capacity,
              first_price_amount as price_amount,
              first_price_currency as price_currency,
              ROUND(((first_total - first_available)::numeric / first_total::numeric) * 100, 2) as utilization_percent
            FROM flight_inventory
            WHERE flight_id = ${flightId}
          `;

          const row = rows[0];
          if (!row) {
            return yield* Effect.fail(new FlightNotFoundError({ flightId }));
          }

          return new CabinAvailability({
            cabin: row.cabin,
            available: row.available,
            capacity: row.capacity,
            price: {
              amount: Number.parseFloat(row.price_amount),
              currency: row.price_currency,
            },
            utilizationPercent: row.utilization_percent,
          });
        } else {
          return yield* Effect.fail(
            new PersistenceError({
              message: `Invalid cabin class: ${cabin}`,
              timestamp: new Date(),
            }),
          );
        }
      }).pipe(
        Effect.catchTag("SqlError", (e) =>
          Effect.fail(
            new PersistenceError({
              message: `Failed to get cabin availability: ${e.message}`,
              cause: e,
              timestamp: new Date(),
            }),
          ),
        ),
      );

    const findAvailableFlights: InventoryQueriesPort["findAvailableFlights"] = (
      params,
    ) =>
      Effect.gen(function* () {
        const { cabin, minSeats } = params;
        const cabinLower = cabin.toLowerCase();

        // Determine which column to check based on cabin
        let rows: FlightAvailabilityRow[];
        if (cabinLower === "economy") {
          rows = yield* sql<FlightAvailabilityRow>`
            SELECT
              flight_id,
              economy_available,
              business_available,
              first_available,
              economy_price_amount,
              economy_price_currency,
              business_price_amount,
              business_price_currency,
              first_price_amount,
              first_price_currency,
              NOW() as last_updated
            FROM flight_inventory
            WHERE economy_available >= ${minSeats}
            ORDER BY flight_id
          `;
        } else if (cabinLower === "business") {
          rows = yield* sql<FlightAvailabilityRow>`
            SELECT
              flight_id,
              economy_available,
              business_available,
              first_available,
              economy_price_amount,
              economy_price_currency,
              business_price_amount,
              business_price_currency,
              first_price_amount,
              first_price_currency,
              NOW() as last_updated
            FROM flight_inventory
            WHERE business_available >= ${minSeats}
            ORDER BY flight_id
          `;
        } else if (cabinLower === "first") {
          rows = yield* sql<FlightAvailabilityRow>`
            SELECT
              flight_id,
              economy_available,
              business_available,
              first_available,
              economy_price_amount,
              economy_price_currency,
              business_price_amount,
              business_price_currency,
              first_price_amount,
              first_price_currency,
              NOW() as last_updated
            FROM flight_inventory
            WHERE first_available >= ${minSeats}
            ORDER BY flight_id
          `;
        } else {
          return yield* Effect.fail(
            new PersistenceError({
              message: `Invalid cabin class: ${cabin}`,
              timestamp: new Date(),
            }),
          );
        }

        return rows.map(
          (row) =>
            new FlightAvailability({
              flightId: row.flight_id,
              economyAvailable: row.economy_available,
              businessAvailable: row.business_available,
              firstAvailable: row.first_available,
              economyPrice: {
                amount: Number.parseFloat(row.economy_price_amount),
                currency: row.economy_price_currency,
              },
              businessPrice: {
                amount: Number.parseFloat(row.business_price_amount),
                currency: row.business_price_currency,
              },
              firstPrice: {
                amount: Number.parseFloat(row.first_price_amount),
                currency: row.first_price_currency,
              },
              lastUpdated: row.last_updated,
            }),
        );
      }).pipe(
        Effect.catchTag("SqlError", (e) =>
          Effect.fail(
            new PersistenceError({
              message: `Failed to find available flights: ${e.message}`,
              cause: e,
              timestamp: new Date(),
            }),
          ),
        ),
      );

    const getLowInventoryAlerts: InventoryQueriesPort["getLowInventoryAlerts"] =
      (threshold) =>
        Effect.gen(function* () {
          const rows = yield* sql<FlightAvailabilityRow>`
            SELECT
              flight_id,
              economy_available,
              business_available,
              first_available,
              economy_price_amount,
              economy_price_currency,
              business_price_amount,
              business_price_currency,
              first_price_amount,
              first_price_currency,
              NOW() as last_updated
            FROM flight_inventory
            WHERE economy_available < ${threshold}
               OR business_available < ${threshold}
               OR first_available < ${threshold}
            ORDER BY
              LEAST(economy_available, business_available, first_available) ASC
          `;

          return rows.map(
            (row) =>
              new FlightAvailability({
                flightId: row.flight_id,
                economyAvailable: row.economy_available,
                businessAvailable: row.business_available,
                firstAvailable: row.first_available,
                economyPrice: {
                  amount: Number.parseFloat(row.economy_price_amount),
                  currency: row.economy_price_currency,
                },
                businessPrice: {
                  amount: Number.parseFloat(row.business_price_amount),
                  currency: row.business_price_currency,
                },
                firstPrice: {
                  amount: Number.parseFloat(row.first_price_amount),
                  currency: row.first_price_currency,
                },
                lastUpdated: row.last_updated,
              }),
          );
        }).pipe(
          Effect.catchTag("SqlError", (e) =>
            Effect.fail(
              new PersistenceError({
                message: `Failed to get low inventory alerts: ${e.message}`,
                cause: e,
                timestamp: new Date(),
              }),
            ),
          ),
        );

    const getInventoryStats: InventoryQueriesPort["getInventoryStats"] = () =>
      Effect.gen(function* () {
        const rows = yield* sql<InventoryStatsRow>`
          SELECT
            COUNT(*)::int as total_flights,
            (SUM(economy_available) + SUM(business_available) + SUM(first_available))::int as total_seats_available,
            ROUND(
              AVG(
                ((economy_total - economy_available + business_total - business_available + first_total - first_available)::numeric /
                 (economy_total + business_total + first_total)::numeric) * 100
              ), 2
            ) as average_utilization,
            COUNT(CASE WHEN economy_available = 0 AND business_available = 0 AND first_available = 0 THEN 1 END)::int as full_flights
          FROM flight_inventory
        `;

        const row = rows[0];
        if (!row) {
          return {
            totalFlights: 0,
            totalSeatsAvailable: 0,
            averageUtilization: 0,
            fullFlights: 0,
          };
        }

        return {
          totalFlights: row.total_flights,
          totalSeatsAvailable: row.total_seats_available,
          averageUtilization: row.average_utilization,
          fullFlights: row.full_flights,
        };
      }).pipe(
        Effect.catchTag("SqlError", (e) =>
          Effect.fail(
            new PersistenceError({
              message: `Failed to get inventory stats: ${e.message}`,
              cause: e,
              timestamp: new Date(),
            }),
          ),
        ),
      );

    return {
      getFlightAvailability,
      getCabinAvailability,
      findAvailableFlights,
      getLowInventoryAlerts,
      getInventoryStats,
    };
  }),
);
