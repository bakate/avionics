import { Coupon } from "@workspace/domain/coupon";
import { FlightId, PnrCodeSchema } from "@workspace/domain/kernel";
import { PassengerId } from "@workspace/domain/passenger";
import {
  Ticket,
  TicketNumber,
  TicketStatusSchema,
} from "@workspace/domain/ticket";
import { Option, Schema } from "effect";

// --- Database Row Types ---

export type TicketRow = {
  readonly ticket_number: string;
  readonly pnr_code: string;
  readonly status: string;
  readonly passenger_id: string;
  readonly passenger_name: string;
  readonly issued_at: Date;
};

export type CouponRow = {
  readonly ticket_number: string;
  readonly coupon_number: number;
  readonly flight_id: string;
  readonly seat_number: string | null;
  readonly status: string;
};

// --- Mappers ---

export const toTicketRow = (ticket: Ticket): TicketRow => ({
  ticket_number: ticket.ticketNumber,
  pnr_code: ticket.pnrCode,
  status: ticket.status,
  passenger_id: ticket.passengerId,
  passenger_name: ticket.passengerName,
  issued_at: ticket.issuedAt,
});

export const toCouponRows = (ticket: Ticket): ReadonlyArray<CouponRow> =>
  ticket.coupons.map((coupon) => ({
    ticket_number: ticket.ticketNumber,
    coupon_number: coupon.couponNumber,
    flight_id: coupon.flightId,
    seat_number: Option.getOrNull(coupon.seatNumber),
    status: coupon.status,
  }));

export const fromTicketRow = (
  row: TicketRow,
  coupons: ReadonlyArray<CouponRow>,
): Ticket => {
  if (coupons.length === 0) {
    throw new Error("Cannot map Ticket: coupons list is empty");
  }

  const domainCoupons = coupons.map(
    (c) =>
      new Coupon({
        couponNumber: c.coupon_number,
        flightId: Schema.decodeUnknownSync(FlightId)(c.flight_id),
        seatNumber: Option.fromNullable(c.seat_number),
        status: c.status as any,
      }),
  ) as [Coupon, ...Array<Coupon>];

  return new Ticket({
    ticketNumber: Schema.decodeUnknownSync(TicketNumber)(row.ticket_number),
    pnrCode: Schema.decodeUnknownSync(PnrCodeSchema)(row.pnr_code),
    status: Schema.decodeUnknownSync(TicketStatusSchema)(row.status),
    passengerId: Schema.decodeUnknownSync(PassengerId)(row.passenger_id),
    passengerName: row.passenger_name,
    coupons: domainCoupons,
    issuedAt: row.issued_at,
  });
};
