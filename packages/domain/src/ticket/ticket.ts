import { Schema } from "effect";
import { PassengerId } from "../booking/passenger.js";
import { PnrCodeSchema } from "../kernel.js";
import { Coupon } from "./coupon.js";

export const TicketNumber = Schema.String.pipe(
	Schema.length(13),
	Schema.pattern(/^\d{13}$/),
	Schema.brand("TicketNumber"),
);
export type TicketNumber = Schema.Schema.Type<typeof TicketNumber>;

// --- Ticket Status ---
export const TicketStatus = {
	ISSUED: "ISSUED",
	REFUNDED: "REFUNDED",
	VOIDED: "VOIDED",
	EXCHANGED: "EXCHANGED",
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];
export const TicketStatusSchema = Schema.Enums(TicketStatus);

export class Ticket extends Schema.Class<Ticket>("Ticket")({
	ticketNumber: TicketNumber,
	pnrCode: PnrCodeSchema,
	status: TicketStatusSchema,
	passengerId: PassengerId,
	passengerName: Schema.String,
	coupons: Schema.NonEmptyArray(Coupon),
	issuedAt: Schema.Date,
}) {}
