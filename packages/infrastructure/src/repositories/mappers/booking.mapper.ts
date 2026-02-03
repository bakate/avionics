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
} from "@workspace/domain/kernel";
import { Passenger, PassengerId } from "@workspace/domain/passenger";
import { BookingSegment } from "@workspace/domain/segment";
import { type Data, Option, Schema } from "effect";

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
  // Reconstruct Domain Objects
  const domainPassengers = passengers.map(
    (p) =>
      new Passenger({
        id: Schema.decodeUnknownSync(PassengerId)(p.id),
        firstName: p.first_name,
        lastName: p.last_name,
        email: Schema.decodeUnknownSync(EmailSchema)(p.email),
        type: Schema.decodeUnknownSync(PassengerTypeSchema)(p.type),
        dateOfBirth: p.date_of_birth ?? new Date(0), // Fallback
        gender: Schema.decodeUnknownSync(GenderSchema)(p.gender),
      }),
  ) as [Passenger, ...Passenger[]];

  const domainSegments = segments.map(
    (s) =>
      new BookingSegment({
        flightId: Schema.decodeUnknownSync(FlightId)(s.flight_id),
        cabin: Schema.decodeUnknownSync(CabinClassSchema)(s.cabin_class),
        price: Money.of(
          Number(s.price_amount),
          Schema.decodeUnknownSync(CurrencyCodeSchema)(s.price_currency),
        ),
      }),
  ) as [BookingSegment, ...BookingSegment[]];

  return new Booking({
    id: Schema.decodeUnknownSync(BookingId)(row.id),
    pnrCode: Schema.decodeUnknownSync(PnrCodeSchema)(row.pnr_code),
    status: Schema.decodeUnknownSync(BookingStatusSchema)(row.status),
    passengers: domainPassengers,
    segments: domainSegments,
    version: row.version,
    createdAt: row.created_at,
    expiresAt: Option.fromNullable(row.expires_at),
    domainEvents: [], // Events are transient, not rehydrated from main tables (Transaction Outbox separate)
  });
};
