import { Schema } from "effect";
import { PnrCodeSchema } from "../kernel.js";

import { Passenger } from "./passenger.js";
import { BookingSegment } from "./segment.js";

export enum PnrStatus {
	HELD = "Held",
	CONFIRMED = "Confirmed",
	TICKETED = "Ticketed",
	CANCELLED = "Cancelled",
	EXPIRED = "Expired",
}
export const BookingStatusSchema = Schema.Enums(PnrStatus);

export const BookingId = Schema.String.pipe(Schema.brand("BookingId"));

// --- Booking Aggregate Root ---
export class Booking extends Schema.Class<Booking>("Booking")({
	id: BookingId,
	pnrCode: PnrCodeSchema,
	status: BookingStatusSchema,
	passengers: Schema.NonEmptyArray(Passenger),
	segments: Schema.NonEmptyArray(BookingSegment),
	expiresAt: Schema.Option(Schema.Date), // Expiration of the HOLD
	createdAt: Schema.Date,
}) {
	isPayable(): boolean {
		return (
			this.status === PnrStatus.HELD || this.status === PnrStatus.CONFIRMED
		);
	}
}
