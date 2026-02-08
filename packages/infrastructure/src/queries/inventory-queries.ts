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
import {
  FlightNotFoundError,
  InvalidAmountError,
} from "@workspace/domain/errors";
import {
  type CabinClass,
  type CurrencyCode,
  type FlightId,
  Money,
} from "@workspace/domain/kernel";
import { Effect, Layer } from "effect";

const safeMoney = ({
  amount,
  currency,
  field,
}: {
  amount: string;
  currency: string;
  field: string;
}) => {
  const value = Number.parseFloat(amount);
  if (!Number.isFinite(value) || value < 0) {
    return Effect.fail(
      new InvalidAmountError({
        amount: value,
        message: `Invalid amount for field ${field}: ${amount}`,
      }),
    );
  }
  return Effect.try({
    try: () => Money.of(value, currency as CurrencyCode),
    catch: (error) =>
      new InvalidAmountError({
        amount: value,
        message: `Error creating Money for field ${field}: ${error}`,
      }),
  });
};

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

const CABIN_COLUMNS = {
  economy: {
    available: "economy_available",
    capacity: "economy_total",
    priceAmount: "economy_price_amount",
    priceCurrency: "economy_price_currency",
  },
  business: {
    available: "business_available",
    capacity: "business_total",
    priceAmount: "business_price_amount",
    priceCurrency: "business_price_currency",
  },
  first: {
    available: "first_available",
    capacity: "first_total",
    priceAmount: "first_price_amount",
    priceCurrency: "first_price_currency",
  },
} as const;

export class PostgresInventoryQueries {
  /**
   * Live Layer — PostgreSQL implementation.
   */
  static readonly Live = Layer.effect(
    InventoryQueries,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      return {
        getFlightAvailability: (flightId) =>
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
              last_updated
            FROM flight_inventory
            WHERE flight_id = ${flightId}
          `;

            const row = rows[0];
            if (!row) {
              return yield* Effect.fail(new FlightNotFoundError({ flightId }));
            }

            return new FlightAvailability({
              flightId: row.flight_id as FlightId,
              economyAvailable: row.economy_available,
              businessAvailable: row.business_available,
              firstAvailable: row.first_available,
              economyPrice: yield* safeMoney({
                amount: row.economy_price_amount,
                currency: row.economy_price_currency,
                field: "economy_price",
              }),
              businessPrice: yield* safeMoney({
                amount: row.business_price_amount,
                currency: row.business_price_currency,
                field: "business_price",
              }),
              firstPrice: yield* safeMoney({
                amount: row.first_price_amount,
                currency: row.first_price_currency,
                field: "first_price",
              }),
              lastUpdated: row.last_updated,
            });
          }).pipe(
            Effect.catchTag("SqlError", () =>
              Effect.fail(new FlightNotFoundError({ flightId })),
            ),
          ),

        getCabinAvailability: (flightId, cabin) =>
          Effect.gen(function* () {
            // Map cabin name to database columns
            const cabinLower = cabin.toLowerCase();
            const columns =
              CABIN_COLUMNS[cabinLower as keyof typeof CABIN_COLUMNS];

            if (!columns) {
              return yield* Effect.fail(new FlightNotFoundError({ flightId }));
            }

            const rows = yield* sql<CabinAvailabilityRow>`
          SELECT
            ${cabinLower} as cabin,
            ${sql(columns.available)} as available,
            ${sql(columns.capacity)} as capacity,
            ${sql(columns.priceAmount)} as price_amount,
            ${sql(columns.priceCurrency)} as price_currency,
            ROUND(((${sql(columns.capacity)} - ${sql(columns.available)})::numeric / ${sql(columns.capacity)}::numeric) * 100, 2) as utilization_percent
          FROM flight_inventory
          WHERE flight_id = ${flightId}
        `;

            const row = rows[0];
            if (!row) {
              return yield* Effect.fail(new FlightNotFoundError({ flightId }));
            }

            return new CabinAvailability({
              cabin: row.cabin as CabinClass,
              available: row.available,
              capacity: row.capacity,
              price: yield* safeMoney({
                amount: row.price_amount,
                currency: row.price_currency,
                field: "cabin_price",
              }),
              utilizationPercent: row.utilization_percent,
            });
          }).pipe(
            Effect.catchTag("SqlError", () =>
              Effect.fail(new FlightNotFoundError({ flightId })),
            ),
          ),

        findAvailableFlights: (params) =>
          Effect.gen(function* () {
            const { cabin, minSeats } = params;
            const cabinLower = cabin.toLowerCase();
            const columns =
              CABIN_COLUMNS[cabinLower as keyof typeof CABIN_COLUMNS];

            if (!columns) {
              return [];
            }

            // Determine which column to check based on cabin
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
            WHERE ${sql(columns.available)} >= ${minSeats}
            ORDER BY flight_id
          `;

            return yield* Effect.all(
              rows.map((row) =>
                Effect.gen(function* () {
                  return new FlightAvailability({
                    flightId: row.flight_id as FlightId,
                    economyAvailable: row.economy_available,
                    businessAvailable: row.business_available,
                    firstAvailable: row.first_available,
                    economyPrice: yield* safeMoney({
                      amount: row.economy_price_amount,
                      currency: row.economy_price_currency,
                      field: "economy_price",
                    }),
                    businessPrice: yield* safeMoney({
                      amount: row.business_price_amount,
                      currency: row.business_price_currency,
                      field: "business_price",
                    }),
                    firstPrice: yield* safeMoney({
                      amount: row.first_price_amount,
                      currency: row.first_price_currency,
                      field: "first_price",
                    }),
                    lastUpdated: row.last_updated,
                  });
                }),
              ),
            );
          }).pipe(
            Effect.catchTag("SqlError", () =>
              Effect.succeed([] as ReadonlyArray<FlightAvailability>),
            ),
          ),

        getLowInventoryAlerts: (threshold) =>
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

            return yield* Effect.all(
              rows.map((row) =>
                Effect.gen(function* () {
                  return new FlightAvailability({
                    flightId: row.flight_id as FlightId,
                    economyAvailable: row.economy_available,
                    businessAvailable: row.business_available,
                    firstAvailable: row.first_available,
                    economyPrice: yield* safeMoney({
                      amount: row.economy_price_amount,
                      currency: row.economy_price_currency,
                      field: "economy_price",
                    }),
                    businessPrice: yield* safeMoney({
                      amount: row.business_price_amount,
                      currency: row.business_price_currency,
                      field: "business_price",
                    }),
                    firstPrice: yield* safeMoney({
                      amount: row.first_price_amount,
                      currency: row.first_price_currency,
                      field: "first_price",
                    }),
                    lastUpdated: row.last_updated,
                  });
                }),
              ),
            );
          }).pipe(
            Effect.catchTag("SqlError", () =>
              Effect.succeed([] as ReadonlyArray<FlightAvailability>),
            ),
          ),

        getInventoryStats: () =>
          Effect.gen(function* () {
            const rows = yield* sql<InventoryStatsRow>`
          SELECT
            COUNT(*)::int as total_flights,
            COALESCE((SUM(economy_available) + SUM(business_available) + SUM(first_available))::int, 0) as total_seats_available,
            COALESCE(ROUND(
              AVG(
                ((economy_total - economy_available + business_total - business_available + first_total - first_available)::numeric /
                 (economy_total + business_total + first_total)::numeric) * 100
              ), 2
            ), 0) as average_utilization,
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
              averageUtilization: Number.parseFloat(
                String(row.average_utilization),
              ),
              fullFlights: row.full_flights,
            };
          }).pipe(
            Effect.catchAll(() =>
              Effect.succeed({
                totalFlights: 0,
                totalSeatsAvailable: 0,
                averageUtilization: 0,
                fullFlights: 0,
              }),
            ),
          ),
      } satisfies InventoryQueriesPort;
    }),
  );

  /**
   * Test Layer — Mock implementation.
   */
  static readonly Test = (overrides: Partial<InventoryQueriesPort> = {}) =>
    Layer.succeed(
      InventoryQueries,
      InventoryQueries.of({
        getFlightAvailability: (flightId) =>
          Effect.fail(new FlightNotFoundError({ flightId })),
        getCabinAvailability: (flightId) =>
          Effect.fail(new FlightNotFoundError({ flightId })),
        findAvailableFlights: () => Effect.succeed([]),
        getLowInventoryAlerts: () => Effect.succeed([]),
        getInventoryStats: () =>
          Effect.succeed({
            totalFlights: 0,
            totalSeatsAvailable: 0,
            averageUtilization: 0,
            fullFlights: 0,
          }),
        ...overrides,
      }),
    );
}
