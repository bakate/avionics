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
  origin: string;
  destination: string;
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

    // Helper to normalize Date values from SQL driver for Schema decoding
    // Schema.Date expects a string (ISO format) on the encoded side
    const toDateString = (d: Date | null): string | null =>
      d instanceof Date ? d.toISOString() : d;

    const getSummaryByPnr: BookingQueriesPort["getSummaryByPnr"] = (pnr) =>
      Effect.gen(function* () {
        const rows = yield* sql<BookingSummaryRow>`
          SELECT
            b.id,
            b.pnr_code,
            b.status,
            (SELECT COUNT(*)::int FROM passengers p WHERE p.booking_id = b.id) as passenger_count,
            COALESCE((SELECT SUM(s.price_amount) FROM segments s WHERE s.booking_id = b.id), 0) as total_price_amount,
            COALESCE((SELECT MAX(s.price_currency) FROM segments s WHERE s.booking_id = b.id), 'EUR') as total_price_currency,
            b.created_at,
            b.expires_at,
            (SELECT fi.origin FROM segments s JOIN flight_inventory fi ON fi.flight_id = s.flight_id WHERE s.booking_id = b.id LIMIT 1) as origin,
            (SELECT fi.destination FROM segments s JOIN flight_inventory fi ON fi.flight_id = s.flight_id WHERE s.booking_id = b.id ORDER BY s.id DESC LIMIT 1) as destination
          FROM bookings b
          WHERE b.pnr_code = ${pnr}
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
          origin: row.origin,
          destination: row.destination,
          passengerCount: row.passenger_count,
          totalPrice: {
            amount: Number.parseFloat(row.total_price_amount),
            currency: row.total_price_currency,
          },
          createdAt: toDateString(row.created_at),
          expiresAt: toDateString(row.expires_at) ?? null,
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
              (SELECT COUNT(*)::int FROM passengers p WHERE p.booking_id = b.id) as passenger_count,
              COALESCE((SELECT SUM(s.price_amount) FROM segments s WHERE s.booking_id = b.id), 0) as total_price_amount,
              COALESCE((SELECT MAX(s.price_currency) FROM segments s WHERE s.booking_id = b.id), 'EUR') as total_price_currency,
              b.created_at,
              b.expires_at
            FROM bookings b
            WHERE b.status = ${status}
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
              (SELECT COUNT(*)::int FROM passengers p WHERE p.booking_id = b.id) as passenger_count,
              COALESCE((SELECT SUM(s.price_amount) FROM segments s WHERE s.booking_id = b.id), 0) as total_price_amount,
              COALESCE((SELECT MAX(s.price_currency) FROM segments s WHERE s.booking_id = b.id), 'EUR') as total_price_currency,
              b.created_at,
              b.expires_at,
              (SELECT fi.origin FROM segments s JOIN flight_inventory fi ON fi.flight_id = s.flight_id WHERE s.booking_id = b.id LIMIT 1) as origin,
              (SELECT fi.destination FROM segments s JOIN flight_inventory fi ON fi.flight_id = s.flight_id WHERE s.booking_id = b.id ORDER BY s.id DESC LIMIT 1) as destination
            FROM bookings b
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
            origin: row.origin,
            destination: row.destination,
            passengerCount: row.passenger_count,
            totalPrice: {
              amount: Number.parseFloat(row.total_price_amount),
              currency: row.total_price_currency,
            },
            createdAt: toDateString(row.created_at),
            expiresAt: toDateString(row.expires_at) ?? null,
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
            ARRAY(SELECT DISTINCT s.flight_id FROM segments s WHERE s.booking_id = b.id) as flight_numbers,
            COALESCE((SELECT SUM(s.price_amount) FROM segments s WHERE s.booking_id = b.id), 0) as total_price_amount,
            COALESCE((SELECT MAX(s.price_currency) FROM segments s WHERE s.booking_id = b.id), 'EUR') as total_price_currency,
            b.created_at as booked_at
          FROM bookings b
          INNER JOIN passengers p ON p.booking_id = b.id
          WHERE p.id = ${passengerId}
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
            bookedAt: toDateString(row.booked_at),
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
            (SELECT COUNT(*)::int FROM passengers p WHERE p.booking_id = b.id) as passenger_count,
            COALESCE((SELECT SUM(s.price_amount) FROM segments s WHERE s.booking_id = b.id), 0) as total_price_amount,
            COALESCE((SELECT MAX(s.price_currency) FROM segments s WHERE s.booking_id = b.id), 'EUR') as total_price_currency,
            b.created_at,
            b.expires_at
          FROM bookings b
          WHERE b.expires_at < ${before}
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
            createdAt: toDateString(row.created_at),
            expiresAt: toDateString(row.expires_at) ?? null,
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
            (SELECT COUNT(*)::int FROM passengers p2 WHERE p2.booking_id = b.id) as passenger_count,
            COALESCE((SELECT SUM(s.price_amount) FROM segments s WHERE s.booking_id = b.id), 0) as total_price_amount,
            COALESCE((SELECT MAX(s.price_currency) FROM segments s WHERE s.booking_id = b.id), 'EUR') as total_price_currency,
            b.created_at,
            b.expires_at
          FROM bookings b
          INNER JOIN passengers p ON p.booking_id = b.id
          WHERE p.first_name ILIKE ${searchPattern}
             OR p.last_name ILIKE ${searchPattern}
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
            createdAt: toDateString(row.created_at),
            expiresAt: toDateString(row.expires_at) ?? null,
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
