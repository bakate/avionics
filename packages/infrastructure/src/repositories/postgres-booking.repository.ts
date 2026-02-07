import { SqlClient } from "@effect/sql";
import {
  BookingRepository,
  type BookingRepositoryPort,
} from "@workspace/application/booking.repository";
import { Booking } from "@workspace/domain/booking";
import {
  BookingPersistenceError,
  OptimisticLockingError,
} from "@workspace/domain/errors";
import { type DomainEventType } from "@workspace/domain/events";
import { Effect, Layer, Option } from "effect";
import {
  type BookingRow,
  fromBookingRow,
  type PassengerRow,
  type SegmentRow,
  toBookingRow,
} from "./mappers/booking.mapper.js";

// Simplified implementation focusing on structure
export const PostgresBookingRepositoryLive = Layer.effect(
  BookingRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const save: BookingRepositoryPort["save"] = (booking) =>
      sql
        .withTransaction(
          Effect.gen(function* () {
            // 1. Insert/Update Booking Root
            const row = toBookingRow(booking);

            // Using explicit Optimistic Lock check
            const result = yield* sql`
            INSERT INTO bookings (id, pnr_code, status, version, created_at, expires_at)
            VALUES (${row.id}, ${row.pnr_code}, ${row.status}, ${row.version + 1}, ${row.created_at}, ${row.expires_at})
            ON CONFLICT (id) DO UPDATE SET
              status = EXCLUDED.status,
              version = bookings.version + 1,
              expires_at = EXCLUDED.expires_at,
              updated_at = NOW()
            WHERE bookings.version = ${booking.version}
            RETURNING version
          `;

            if (result.length === 0) {
              // Retrieve current version to report actual
              const existing = yield* sql<{
                version: number;
              }>`SELECT version FROM bookings WHERE id = ${booking.id}`;
              const firstExisting = existing[0];
              const actualVersion = firstExisting
                ? (firstExisting.version as number)
                : -1;

              return yield* Effect.fail(
                new OptimisticLockingError({
                  entityType: "Booking",
                  id: booking.id,
                  expectedVersion: booking.version,
                  actualVersion: actualVersion,
                }),
              );
            }

            const resultRow = result[0];
            if (!resultRow) {
              return yield* Effect.fail(
                new BookingPersistenceError({
                  bookingId: booking.id,
                  reason: "Failed to retrieve update result",
                }),
              );
            }

            const returnedVersion = resultRow.version as number;
            if (returnedVersion !== booking.version + 1) {
              return yield* Effect.fail(
                new OptimisticLockingError({
                  entityType: "Booking",
                  id: booking.id,
                  expectedVersion: booking.version,
                  actualVersion: returnedVersion - 1,
                }),
              );
            }

            // 2. Save Passengers/Segments (Full Replace strategy for simplicity within transaction)
            yield* sql`DELETE FROM passengers WHERE booking_id = ${booking.id}`;
            yield* sql`DELETE FROM segments WHERE booking_id = ${booking.id}`;

            // Re-insert passengers (Batch)
            if (booking.passengers.length > 0) {
              for (const p of booking.passengers) {
                yield* sql`
                INSERT INTO passengers (id, booking_id, first_name, last_name, email, date_of_birth, gender, type)
                VALUES (${p.id}, ${booking.id}, ${p.firstName}, ${p.lastName}, ${p.email}, ${p.dateOfBirth}, ${p.gender}, ${p.type})
              `;
              }
            }

            if (booking.segments.length > 0) {
              for (const s of booking.segments) {
                yield* sql`
                INSERT INTO segments (id, booking_id, flight_id, cabin_class, price_amount, price_currency, seat_number)
                VALUES (${s.id}, ${booking.id}, ${s.flightId}, ${s.cabin}, ${s.price.amount}, ${s.price.currency}, ${Option.getOrNull(s.seatNumber)})
              `;
              }
            }

            // 3. Save Domain Events (Transactional Outbox)
            if (booking.domainEvents.length > 0) {
              for (const event of booking.domainEvents as Array<DomainEventType>) {
                yield* sql`
                INSERT INTO event_outbox (id, event_type, aggregate_id, payload)
                VALUES (${String(event.eventId)}, ${"_tag" in event ? String(event._tag) : event.constructor.name}, ${String(booking.id)}, ${JSON.stringify(event)})
              `;
              }
            }

            return new Booking({
              ...booking,
              version: returnedVersion,
            }).clearEvents();
          }),
        )
        .pipe(
          Effect.mapError((e) => {
            return e instanceof OptimisticLockingError
              ? e
              : new BookingPersistenceError({
                  bookingId: booking.id,
                  reason: e instanceof Error ? e.message : String(e),
                });
          }),
        );

    return {
      save,
      findById: (id) =>
        Effect.gen(function* () {
          const bookings = yield* sql<BookingRow>`
             SELECT * FROM bookings WHERE id = ${id}
           `;

          const booking = bookings[0];
          if (!booking) {
            return Option.none();
          }

          const passengers = yield* sql<PassengerRow>`
             SELECT * FROM passengers WHERE booking_id = ${id}
           `;

          const segments = yield* sql<SegmentRow>`
             SELECT * FROM segments WHERE booking_id = ${id}
           `;

          const domainBooking = yield* Effect.try({
            try: () => fromBookingRow(booking, passengers, segments),
            catch: (e) =>
              new BookingPersistenceError({
                bookingId: id,
                reason: e instanceof Error ? e.message : String(e),
              }),
          });
          return Option.some(domainBooking);
        }).pipe(
          Effect.catchTag("SqlError", (e) =>
            Effect.fail(
              new BookingPersistenceError({
                bookingId: id,
                reason: e.message,
              }),
            ),
          ),
        ),

      findByPnr: (pnr) =>
        Effect.gen(function* () {
          const bookings = yield* sql<BookingRow>`
             SELECT * FROM bookings WHERE pnr_code = ${pnr}
           `;

          const booking = bookings[0];
          if (!booking) {
            return Option.none();
          }

          const passengers = yield* sql<PassengerRow>`
             SELECT * FROM passengers WHERE booking_id = ${booking.id}
           `;

          const segments = yield* sql<SegmentRow>`
             SELECT * FROM segments WHERE booking_id = ${booking.id}
           `;

          const domainBooking = yield* Effect.try({
            try: () => fromBookingRow(booking, passengers, segments),
            catch: (e) =>
              new BookingPersistenceError({
                bookingId: pnr,
                reason: e instanceof Error ? e.message : String(e),
              }),
          });
          return Option.some(domainBooking);
        }).pipe(
          Effect.catchTag("SqlError", (e) =>
            Effect.fail(
              new BookingPersistenceError({
                bookingId: pnr,
                reason: e.message,
              }),
            ),
          ),
        ),

      findExpired: (before) =>
        Effect.gen(function* () {
          const bookings = yield* sql<BookingRow>`
             SELECT * FROM bookings WHERE expires_at < ${before}
           `;

          const results: Array<Booking> = [];
          for (const row of bookings) {
            const passengers = yield* sql<PassengerRow>`
               SELECT * FROM passengers WHERE booking_id = ${row.id}
             `;
            const segments = yield* sql<SegmentRow>`
               SELECT * FROM segments WHERE booking_id = ${row.id}
             `;

            // Wrap mapper in a try to catch runtime integrity errors as typed failures
            const booking = yield* Effect.try({
              try: () => fromBookingRow(row, passengers, segments),
              catch: (e) =>
                new BookingPersistenceError({
                  bookingId: row.id,
                  reason: e instanceof Error ? e.message : String(e),
                }),
            });
            results.push(booking);
          }
          return results;
        }).pipe(
          Effect.catchTag("SqlError", (e) =>
            Effect.fail(
              new BookingPersistenceError({
                bookingId: "all-expired",
                reason: e.message,
              }),
            ),
          ),
        ),

      findByPassengerId: (passengerId) =>
        Effect.gen(function* () {
          // Find booking IDs first
          const rows = yield* sql<{ booking_id: string }>`
             SELECT DISTINCT booking_id FROM passengers WHERE id = ${passengerId}
           `;

          const results: Array<Booking> = [];
          for (const { booking_id } of rows) {
            const bookings = yield* sql<BookingRow>`
               SELECT * FROM bookings WHERE id = ${booking_id}
             `;
            if (bookings.length > 0) {
              const passengers = yield* sql<PassengerRow>`
                 SELECT * FROM passengers WHERE booking_id = ${booking_id}
               `;
              const segments = yield* sql<SegmentRow>`
                 SELECT * FROM segments WHERE booking_id = ${booking_id}
               `;

              const bookingRow = bookings[0];
              if (!bookingRow) continue;

              const booking = yield* Effect.try({
                try: () => fromBookingRow(bookingRow, passengers, segments),
                catch: (e) =>
                  new BookingPersistenceError({
                    bookingId: booking_id,
                    reason: e instanceof Error ? e.message : String(e),
                  }),
              });
              results.push(booking);
            }
          }
          return results;
        }).pipe(
          Effect.catchTag("SqlError", (e) =>
            Effect.fail(
              new BookingPersistenceError({
                bookingId: "by-passenger",
                reason: e.message,
              }),
            ),
          ),
        ),

      findAll: () =>
        Effect.gen(function* () {
          const bookings = yield* sql<BookingRow>`
             SELECT * FROM bookings ORDER BY created_at DESC
           `;

          const results: Array<Booking> = [];
          for (const row of bookings) {
            const passengers = yield* sql<PassengerRow>`
               SELECT * FROM passengers WHERE booking_id = ${row.id}
             `;
            const segments = yield* sql<SegmentRow>`
               SELECT * FROM segments WHERE booking_id = ${row.id}
             `;
            const booking = yield* Effect.try({
              try: () => fromBookingRow(row, passengers, segments),
              catch: (e) =>
                new BookingPersistenceError({
                  bookingId: row.id,
                  reason: e instanceof Error ? e.message : String(e),
                }),
            });
            results.push(booking);
          }
          return results;
        }).pipe(
          Effect.catchTag("SqlError", (e) =>
            Effect.fail(
              new BookingPersistenceError({
                bookingId: "all",
                reason: e.message,
              }),
            ),
          ),
        ),
    };
  }),
);
