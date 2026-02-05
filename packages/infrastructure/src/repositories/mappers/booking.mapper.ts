import { Booking, BookingStatusSchema } from "@workspace/domain/booking";
import {
  BookingId,
  CabinClassSchema,
  CurrencyCodeSchema,
  EmailSchema,
  FlightId,
  GenderSchema,
  Money,
  PassengerTypeSchema,
  PnrCodeSchema,
  SegmentId,
} from "@workspace/domain/kernel";
import { Passenger, PassengerId } from "@workspace/domain/passenger";
import { BookingSegment } from "@workspace/domain/segment";
import { Option, Schema } from "effect";

// --- Database Row Types (Private to Infrastructure) ---

export interface BookingRow {
  readonly id: string;
  readonly pnr_code: string;
  readonly status: string;
  readonly version: number;
  readonly created_at: Date;
  readonly updated_at: Date;
  readonly expires_at: Date | null;
}

export interface PassengerRow {
  readonly id: string;
  readonly booking_id: string;
  readonly first_name: string;
  readonly last_name: string; // Adjusted from domain which might have singular name
  readonly email: string;
  readonly date_of_birth: Date | null;
  readonly gender: string;
  readonly type: string;
}

export interface SegmentRow {
  readonly id: string;
  readonly booking_id: string;
  readonly flight_id: string;
  readonly cabin_class: string;
  readonly price_amount: number;
  readonly price_currency: string;
}

// --- Mappers ---

export const toBookingRow = (booking: Booking): BookingRow => ({
  id: booking.id,
  pnr_code: booking.pnrCode,
  status: booking.status,
  version: booking.version,
  created_at: booking.createdAt,
  updated_at: new Date(), // Generally managed by DB trigger, but safe to send
  expires_at: Option.getOrNull(booking.expiresAt),
});

export const fromBookingRow = (
  row: BookingRow,
  passengers: ReadonlyArray<PassengerRow>,
  segments: ReadonlyArray<SegmentRow>,
): Booking => {
  // Runtime Integrity Checks
  if (passengers.length === 0) {
    throw new Error("Cannot map Booking: passengers list is empty");
  }
  if (segments.length === 0) {
    throw new Error("Cannot map Booking: segments list is empty");
  }

  // Reconstruct Domain Objects
  const domainPassengers = passengers.map((p) => {
    if (!p.date_of_birth) {
      throw new Error(`Missing date_of_birth for passenger ${p.id}`);
    }
    if (!p.gender) {
      throw new Error(`Missing gender for passenger ${p.id}`);
    }
    if (!p.type) {
      throw new Error(`Missing type for passenger ${p.id}`);
    }

    return new Passenger({
      id: Schema.decodeUnknownSync(PassengerId)(p.id),
      firstName: p.first_name,
      lastName: p.last_name,
      email: Schema.decodeUnknownSync(EmailSchema)(p.email),
      type: Schema.decodeUnknownSync(PassengerTypeSchema)(p.type),
      dateOfBirth: p.date_of_birth,
      gender: Schema.decodeUnknownSync(GenderSchema)(p.gender),
    });
  }) as [Passenger, ...Array<Passenger>];

  const domainSegments = segments.map(
    (s) =>
      new BookingSegment({
        id: Schema.decodeUnknownSync(SegmentId)(s.id),
        flightId: Schema.decodeUnknownSync(FlightId)(s.flight_id),
        cabin: Schema.decodeUnknownSync(CabinClassSchema)(s.cabin_class),
        price: Money.of(
          Number(s.price_amount),
          Schema.decodeUnknownSync(CurrencyCodeSchema)(s.price_currency),
        ),
      }),
  ) as [BookingSegment, ...Array<BookingSegment>];

  return new Booking({
    id: Schema.decodeUnknownSync(BookingId)(row.id),
    pnrCode: Schema.decodeUnknownSync(PnrCodeSchema)(row.pnr_code),
    status: Schema.decodeUnknownSync(BookingStatusSchema)(row.status),
    passengers: domainPassengers,
    segments: domainSegments,
    version: row.version,
    createdAt: row.created_at,
    expiresAt: Option.fromNullable(row.expires_at),
    domainEvents: [], // Events are transient, not rehydrated from main tables
  });
};
