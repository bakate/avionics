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
import * as Events from "@workspace/domain/events";
import { Effect, Layer, Option } from "effect";
import {
  type BookingRow,
  fromBookingRow,
  type PassengerRow,
  type SegmentRow,
  toBookingRow,
} from "./mappers/booking.mapper.js";

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
 * PostgreSQL implementation of the BookingRepository.
 */
export const PostgresBookingRepositoryLive = Layer.effect(
  BookingRepository,
  Effect.gen(function* () {
    const sqlPool = yield* SqlClient.SqlClient;

    const save: BookingRepositoryPort["save"] = (booking) =>
      Effect.serviceOption(SqlClient.SqlClient).pipe(
        Effect.flatMap((maybeSql) => {
          const sql = Option.getOrElse(maybeSql, () => sqlPool);

          return sql.withTransaction(
            Effect.gen(function* () {
              // 1. Insert/Update Booking Root
              const row = toBookingRow(booking);

              // Using explicit Optimistic Lock check with UUID casting
              const result = yield* sql`
                INSERT INTO bookings (id, pnr_code, status, version, created_at, expires_at)
                VALUES (
                  ${row.id}::uuid,
                  ${row.pnr_code},
                  ${row.status},
                  ${row.version + 1},
                  ${row.created_at},
                  ${row.expires_at}
                )
                ON CONFLICT (id) DO UPDATE SET
                  status = EXCLUDED.status,
                  version = bookings.version + 1,
                  expires_at = EXCLUDED.expires_at,
                  updated_at = NOW()
                WHERE bookings.version = ${booking.version}
                RETURNING version
              `;

              if (result.length === 0) {
                const existing = yield* sql<{
                  version: number;
                }>`SELECT version FROM bookings WHERE id = ${booking.id}::uuid`;
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

              // 2. Save Passengers/Segments (Full Replace strategy within transaction)
              yield* sql`DELETE FROM passengers WHERE booking_id = ${booking.id}::uuid`;
              yield* sql`DELETE FROM segments WHERE booking_id = ${booking.id}::uuid`;

              if (booking.passengers.length > 0) {
                for (const p of booking.passengers) {
                  yield* sql`
                    INSERT INTO passengers (id, booking_id, first_name, last_name, email, date_of_birth, gender, type)
                    VALUES (
                      ${p.id}::uuid,
                      ${booking.id}::uuid,
                      ${p.firstName},
                      ${p.lastName},
                      ${p.email},
                      ${p.dateOfBirth},
                      ${p.gender},
                      ${p.type}
                    )
                  `;
                }
              }

              if (booking.segments.length > 0) {
                for (const s of booking.segments) {
                  yield* sql`
                    INSERT INTO segments (id, booking_id, flight_id, cabin_class, price_amount, price_currency, seat_number)
                    VALUES (
                      ${s.id}::uuid,
                      ${booking.id}::uuid,
                      ${s.flightId},
                      ${s.cabin},
                      ${s.price.amount},
                      ${s.price.currency},
                      ${Option.getOrNull(s.seatNumber ?? Option.none())}
                    )
                  `;
                }
              }

              // 3. Save Domain Events (Transactional Outbox)
              if (booking.domainEvents.length > 0) {
                for (const event of booking.domainEvents as Array<Events.DomainEventType>) {
                  const eventType = getEventTag(event);

                  yield* sql`
                    INSERT INTO event_outbox (id, event_type, aggregate_id, payload)
                    VALUES (
                      ${String(event.eventId)}::uuid,
                      ${eventType},
                      ${String(booking.id)},
                      ${JSON.stringify(event)}
                    )
                  `;
                }
              }

              return new Booking({
                ...booking,
                version: returnedVersion,
              }).clearEvents();
            }),
          );
        }),
        Effect.tapError((e) =>
          Effect.logError("Booking Repository Save Error", e),
        ),
        Effect.mapError((e) => {
          if (e instanceof OptimisticLockingError) return e;
          return new BookingPersistenceError({
            bookingId: booking.id,
            reason: e instanceof Error ? e.message : String(e),
          });
        }),
      );

    return BookingRepository.of({
      save,
      findById: (id) =>
        Effect.gen(function* () {
          const bookings = yield* sqlPool<BookingRow>`
            SELECT * FROM bookings WHERE id = ${id}::uuid
          `;

          const booking = bookings[0];
          if (!booking) {
            return Option.none();
          }

          const passengers = yield* sqlPool<PassengerRow>`
            SELECT * FROM passengers WHERE booking_id = ${id}::uuid
          `;

          const segments = yield* sqlPool<SegmentRow>`
            SELECT * FROM segments WHERE booking_id = ${id}::uuid
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
          const bookings = yield* sqlPool<BookingRow>`
            SELECT * FROM bookings WHERE pnr_code = ${pnr}
          `;

          const booking = bookings[0];
          if (!booking) {
            return Option.none();
          }

          const passengers = yield* sqlPool<PassengerRow>`
            SELECT * FROM passengers WHERE booking_id = ${booking.id}::uuid
          `;

          const segments = yield* sqlPool<SegmentRow>`
            SELECT * FROM segments WHERE booking_id = ${booking.id}::uuid
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
          const bookings = yield* sqlPool<BookingRow>`
            SELECT * FROM bookings WHERE expires_at < ${before}
          `;

          if (bookings.length === 0) {
            return [];
          }

          const ids = bookings.map((b) => b.id);
          const passengers = yield* sqlPool<PassengerRow>`
            SELECT * FROM passengers WHERE booking_id = ANY(${ids}::uuid[])
          `;
          const segments = yield* sqlPool<SegmentRow>`
            SELECT * FROM segments WHERE booking_id = ANY(${ids}::uuid[])
          `;

          const passengersMap = new Map<string, Array<PassengerRow>>();
          for (const p of passengers) {
            const list = passengersMap.get(p.booking_id) ?? [];
            list.push(p);
            passengersMap.set(p.booking_id, list);
          }

          const segmentsMap = new Map<string, Array<SegmentRow>>();
          for (const s of segments) {
            const list = segmentsMap.get(s.booking_id) ?? [];
            list.push(s);
            segmentsMap.set(s.booking_id, list);
          }

          return yield* Effect.forEach(bookings, (row) =>
            Effect.try({
              try: () =>
                fromBookingRow(
                  row,
                  passengersMap.get(row.id) ?? [],
                  segmentsMap.get(row.id) ?? [],
                ),
              catch: (e) =>
                new BookingPersistenceError({
                  bookingId: row.id,
                  reason: e instanceof Error ? e.message : String(e),
                }),
            }),
          );
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
          const passengerRows = yield* sqlPool<{ booking_id: string }>`
            SELECT DISTINCT booking_id FROM passengers WHERE id = ${passengerId}::uuid
          `;

          if (passengerRows.length === 0) {
            return [];
          }

          const ids = passengerRows.map((r) => r.booking_id);
          const bookings = yield* sqlPool<BookingRow>`
            SELECT * FROM bookings WHERE id = ANY(${ids}::uuid[])
          `;

          if (bookings.length === 0) {
            return [];
          }

          const passengers = yield* sqlPool<PassengerRow>`
             SELECT * FROM passengers WHERE booking_id = ANY(${ids}::uuid[])
          `;
          const segments = yield* sqlPool<SegmentRow>`
             SELECT * FROM segments WHERE booking_id = ANY(${ids}::uuid[])
          `;

          const passengersMap = new Map<string, Array<PassengerRow>>();
          for (const p of passengers) {
            const list = passengersMap.get(p.booking_id) ?? [];
            list.push(p);
            passengersMap.set(p.booking_id, list);
          }

          const segmentsMap = new Map<string, Array<SegmentRow>>();
          for (const s of segments) {
            const list = segmentsMap.get(s.booking_id) ?? [];
            list.push(s);
            segmentsMap.set(s.booking_id, list);
          }

          return yield* Effect.forEach(bookings, (row) =>
            Effect.try({
              try: () =>
                fromBookingRow(
                  row,
                  passengersMap.get(row.id) ?? [],
                  segmentsMap.get(row.id) ?? [],
                ),
              catch: (e) =>
                new BookingPersistenceError({
                  bookingId: row.id,
                  reason: e instanceof Error ? e.message : String(e),
                }),
            }),
          );
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

      findAll: (options) =>
        Effect.gen(function* () {
          const limit = Math.min(options?.limit ?? 100, 1000);
          const offset = options?.offset ?? 0;
          const bookings = yield* sqlPool<BookingRow>`
            SELECT * FROM bookings ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
          `;

          if (bookings.length === 0) {
            return [];
          }

          const ids = bookings.map((b) => b.id);
          const passengers = yield* sqlPool<PassengerRow>`
            SELECT * FROM passengers WHERE booking_id = ANY(${ids}::uuid[])
          `;
          const segments = yield* sqlPool<SegmentRow>`
            SELECT * FROM segments WHERE booking_id = ANY(${ids}::uuid[])
          `;

          const passengersMap = new Map<string, Array<PassengerRow>>();
          for (const p of passengers) {
            const list = passengersMap.get(p.booking_id) ?? [];
            list.push(p);
            passengersMap.set(p.booking_id, list);
          }

          const segmentsMap = new Map<string, Array<SegmentRow>>();
          for (const s of segments) {
            const list = segmentsMap.get(s.booking_id) ?? [];
            list.push(s);
            segmentsMap.set(s.booking_id, list);
          }

          return yield* Effect.forEach(bookings, (row) =>
            Effect.try({
              try: () =>
                fromBookingRow(
                  row,
                  passengersMap.get(row.id) ?? [],
                  segmentsMap.get(row.id) ?? [],
                ),
              catch: (e) =>
                new BookingPersistenceError({
                  bookingId: row.id,
                  reason: e instanceof Error ? e.message : String(e),
                }),
            }),
          );
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
    });
  }),
);

/**
 * Test Layer — Mock implementation.
 */
export const PostgresBookingRepositoryTest = (
  overrides: Partial<BookingRepositoryPort> = {},
) =>
  Layer.succeed(
    BookingRepository,
    BookingRepository.of({
      save: (booking) => Effect.succeed(booking),
      findById: () => Effect.succeed(Option.none()),
      findByPnr: () => Effect.succeed(Option.none()),
      findExpired: () => Effect.succeed([]),
      findByPassengerId: () => Effect.succeed([]),
      findAll: (_options) => Effect.succeed([]),
      ...overrides,
    }),
  );
