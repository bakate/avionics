/**
 * @file booking-queries.ts
 * @module @workspace/infrastructure/queries
 * @description CQRS read-side implementation for booking queries
 */

import { SqlClient } from "@effect/sql";
import {
  BookingQueries,
  type BookingQueriesPort,
} from "@workspace/application/booking-queries";
import {
  BookingSummary,
  PassengerBookingHistory,
} from "@workspace/application/read-models";
import {
  BookingNotFoundError,
  BookingPersistenceError,
} from "@workspace/domain/errors";
import { Effect, Layer, Schema } from "effect";

// Database row types for queries
interface BookingSummaryRow {
  id: string;
  pnr_code: string;
  status: string;
  passenger_count: number;
  total_price_amount: string;
  total_price_currency: string;
  created_at: Date;
  expires_at: Date | null;
}

interface PassengerHistoryRow {
  booking_id: string;
  pnr_code: string;
  status: string;
  flight_numbers: Array<string>;
  total_price_amount: string;
  total_price_currency: string;
  booked_at: Date;
}

/**
 * PostgreSQL implementation of the BookingQueries.
 */
export const PostgresBookingQueriesLive = Layer.effect(
  BookingQueries,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const getSummaryByPnr: BookingQueriesPort["getSummaryByPnr"] = (pnr) =>
      Effect.gen(function* () {
        const rows = yield* sql<BookingSummaryRow>`
          SELECT
            b.id,
            b.pnr_code,
            b.status,
            COUNT(DISTINCT p.id)::int as passenger_count,
            COALESCE(SUM(s.price_amount), 0) as total_price_amount,
            COALESCE(MAX(s.price_currency), 'EUR') as total_price_currency,
            b.created_at,
            b.expires_at
          FROM bookings b
          LEFT JOIN passengers p ON p.booking_id = b.id
          LEFT JOIN segments s ON s.booking_id = b.id
          WHERE b.pnr_code = ${pnr}
          GROUP BY b.id, b.pnr_code, b.status, b.created_at, b.expires_at
        `;

        const row = rows[0];
        if (!row) {
          return yield* Effect.fail(
            new BookingNotFoundError({ searchkey: pnr }),
          );
        }

        // Use Schema to decode and validate the plain object from DB
        const summary = yield* Schema.decodeUnknown(BookingSummary)({
          id: row.id,
          pnrCode: row.pnr_code,
          status: row.status,
          passengerCount: row.passenger_count,
          totalPrice: {
            amount: Number.parseFloat(row.total_price_amount),
            currency: row.total_price_currency,
          },
          createdAt: row.created_at,
          expiresAt: row.expires_at ?? null,
        }).pipe(
          Effect.mapError(
            (error) =>
              new BookingPersistenceError({
                bookingId: pnr,
                reason: `Failed to decode booking summary: ${error.message}`,
              }),
          ),
        );

        return summary;
      }).pipe(
        Effect.catchTag("SqlError", (error) =>
          Effect.fail(
            new BookingPersistenceError({
              bookingId: pnr,
              reason: error.message,
            }),
          ),
        ),
      );

    const listBookings: BookingQueriesPort["listBookings"] = (params) =>
      Effect.gen(function* () {
        const { page, pageSize, status } = params;
        const offset = (page - 1) * pageSize;

        // Get total count
        let total: number;
        if (status) {
          const countRows = yield* sql<{ count: number }>`
            SELECT COUNT(*)::int as count
            FROM bookings b
            WHERE b.status = ${status}
          `;
          total = countRows[0]?.count ?? 0;
        } else {
          const countRows = yield* sql<{ count: number }>`
            SELECT COUNT(*)::int as count
            FROM bookings b
          `;
          total = countRows[0]?.count ?? 0;
        }

        // Get paginated results
        let rows: ReadonlyArray<BookingSummaryRow>;
        if (status) {
          rows = yield* sql<BookingSummaryRow>`
            SELECT
              b.id,
              b.pnr_code,
              b.status,
              COUNT(DISTINCT p.id)::int as passenger_count,
              COALESCE(SUM(s.price_amount), 0) as total_price_amount,
              COALESCE(MAX(s.price_currency), 'EUR') as total_price_currency,
              b.created_at,
              b.expires_at
            FROM bookings b
            LEFT JOIN passengers p ON p.booking_id = b.id
            LEFT JOIN segments s ON s.booking_id = b.id
            WHERE b.status = ${status}
            GROUP BY b.id, b.pnr_code, b.status, b.created_at, b.expires_at
            ORDER BY b.created_at DESC
            LIMIT ${pageSize}
            OFFSET ${offset}
          `;
        } else {
          rows = yield* sql<BookingSummaryRow>`
            SELECT
              b.id,
              b.pnr_code,
              b.status,
              COUNT(DISTINCT p.id)::int as passenger_count,
              COALESCE(SUM(s.price_amount), 0) as total_price_amount,
              COALESCE(MAX(s.price_currency), 'EUR') as total_price_currency,
              b.created_at,
              b.expires_at
            FROM bookings b
            LEFT JOIN passengers p ON p.booking_id = b.id
            LEFT JOIN segments s ON s.booking_id = b.id
            GROUP BY b.id, b.pnr_code, b.status, b.created_at, b.expires_at
            ORDER BY b.created_at DESC
            LIMIT ${pageSize}
            OFFSET ${offset}
          `;
        }

        const items = yield* Effect.forEach(rows, (row) =>
          Schema.decodeUnknown(BookingSummary)({
            id: row.id,
            pnrCode: row.pnr_code,
            status: row.status,
            passengerCount: row.passenger_count,
            totalPrice: {
              amount: Number.parseFloat(row.total_price_amount),
              currency: row.total_price_currency,
            },
            createdAt: row.created_at,
            expiresAt: row.expires_at ?? null,
          }).pipe(
            Effect.mapError(
              (error) =>
                new BookingPersistenceError({
                  bookingId: row.id,
                  reason: `Failed to decode booking summary: ${error.message}`,
                }),
            ),
          ),
        );

        return {
          items,
          total,
          page,
          pageSize,
        };
      }).pipe(
        Effect.catchTag("SqlError", () =>
          Effect.succeed({
            items: [] as ReadonlyArray<BookingSummary>,
            total: 0,
            page: params.page,
            pageSize: params.pageSize,
          }),
        ),
      );

    const getPassengerHistory: BookingQueriesPort["getPassengerHistory"] = (
      passengerId,
    ) =>
      Effect.gen(function* () {
        const rows = yield* sql<PassengerHistoryRow>`
          SELECT
            b.id as booking_id,
            b.pnr_code,
            b.status,
            ARRAY_AGG(DISTINCT s.flight_id) as flight_numbers,
            COALESCE(SUM(s.price_amount), 0) as total_price_amount,
            COALESCE(MAX(s.price_currency), 'EUR') as total_price_currency,
            b.created_at as booked_at
          FROM bookings b
          INNER JOIN passengers p ON p.booking_id = b.id
          LEFT JOIN segments s ON s.booking_id = b.id
          WHERE p.id = ${passengerId}
          GROUP BY b.id, b.pnr_code, b.status, b.created_at
          ORDER BY b.created_at DESC
        `;

        return yield* Effect.forEach(rows, (row) =>
          Schema.decodeUnknown(PassengerBookingHistory)({
            bookingId: row.booking_id,
            pnrCode: row.pnr_code,
            status: row.status,
            flightNumbers: row.flight_numbers || [],
            totalPrice: {
              amount: Number.parseFloat(row.total_price_amount),
              currency: row.total_price_currency,
            },
            bookedAt: row.booked_at,
          }).pipe(
            Effect.mapError(
              (error) =>
                new BookingPersistenceError({
                  bookingId: row.booking_id,
                  reason: `Failed to decode passenger history: ${error.message}`,
                }),
            ),
          ),
        );
      }).pipe(
        Effect.catchTag("SqlError", () =>
          Effect.succeed([] as ReadonlyArray<PassengerBookingHistory>),
        ),
      );

    const findExpiredBookings: BookingQueriesPort["findExpiredBookings"] = (
      before,
      limit,
    ) =>
      Effect.gen(function* () {
        const rows = yield* sql<BookingSummaryRow>`
          SELECT
            b.id,
            b.pnr_code,
            b.status,
            COUNT(DISTINCT p.id)::int as passenger_count,
            COALESCE(SUM(s.price_amount), 0) as total_price_amount,
            COALESCE(MAX(s.price_currency), 'EUR') as total_price_currency,
            b.created_at,
            b.expires_at
          FROM bookings b
          LEFT JOIN passengers p ON p.booking_id = b.id
          LEFT JOIN segments s ON s.booking_id = b.id
          WHERE b.expires_at < ${before}
          GROUP BY b.id, b.pnr_code, b.status, b.created_at, b.expires_at
          ORDER BY b.expires_at ASC
          LIMIT ${limit}
        `;

        return yield* Effect.forEach(rows, (row) =>
          Schema.decodeUnknown(BookingSummary)({
            id: row.id,
            pnrCode: row.pnr_code,
            status: row.status,
            passengerCount: row.passenger_count,
            totalPrice: {
              amount: Number.parseFloat(row.total_price_amount),
              currency: row.total_price_currency,
            },
            createdAt: row.created_at,
            expiresAt: row.expires_at ?? null,
          }).pipe(
            Effect.mapError(
              (error) =>
                new BookingPersistenceError({
                  bookingId: row.id,
                  reason: `Failed to decode expired booking: ${error.message}`,
                }),
            ),
          ),
        );
      }).pipe(
        Effect.catchTag("SqlError", () =>
          Effect.succeed([] as ReadonlyArray<BookingSummary>),
        ),
      );

    const searchByPassengerName: BookingQueriesPort["searchByPassengerName"] = (
      name,
      limit,
    ) =>
      Effect.gen(function* () {
        const searchPattern = `%${name}%`;
        const rows = yield* sql<BookingSummaryRow>`
          SELECT DISTINCT
            b.id,
            b.pnr_code,
            b.status,
            COUNT(DISTINCT p.id)::int as passenger_count,
            COALESCE(SUM(s.price_amount), 0) as total_price_amount,
            COALESCE(MAX(s.price_currency), 'EUR') as total_price_currency,
            b.created_at,
            b.expires_at
          FROM bookings b
          INNER JOIN passengers p ON p.booking_id = b.id
          LEFT JOIN segments s ON s.booking_id = b.id
          WHERE p.first_name ILIKE ${searchPattern}
             OR p.last_name ILIKE ${searchPattern}
          GROUP BY b.id, b.pnr_code, b.status, b.created_at, b.expires_at
          ORDER BY b.created_at DESC
          LIMIT ${limit}
        `;

        return yield* Effect.forEach(rows, (row) =>
          Schema.decodeUnknown(BookingSummary)({
            id: row.id,
            pnrCode: row.pnr_code,
            status: row.status,
            passengerCount: row.passenger_count,
            totalPrice: {
              amount: Number.parseFloat(row.total_price_amount),
              currency: row.total_price_currency,
            },
            createdAt: row.created_at,
            expiresAt: row.expires_at ?? null,
          }).pipe(
            Effect.mapError(
              (error) =>
                new BookingPersistenceError({
                  bookingId: row.id,
                  reason: `Failed to decode search result: ${error.message}`,
                }),
            ),
          ),
        );
      }).pipe(
        Effect.catchTag("SqlError", () =>
          Effect.succeed([] as ReadonlyArray<BookingSummary>),
        ),
      );

    return {
      getSummaryByPnr,
      listBookings,
      getPassengerHistory,
      findExpiredBookings,
      searchByPassengerName,
    };
  }),
);

/**
 * Test Layer — Mock implementation.
 */
export const PostgresBookingQueriesTest = (
  overrides: Partial<BookingQueriesPort> = {},
) =>
  Layer.succeed(
    BookingQueries,
    BookingQueries.of({
      getSummaryByPnr: (pnr) =>
        Effect.fail(new BookingNotFoundError({ searchkey: pnr })),
      listBookings: (params) =>
        Effect.succeed({
          items: [],
          total: 0,
          page: params.page,
          pageSize: params.pageSize,
        }),
      getPassengerHistory: () => Effect.succeed([]),
      findExpiredBookings: () => Effect.succeed([]),
      searchByPassengerName: () => Effect.succeed([]),
      ...overrides,
    }),
  );
