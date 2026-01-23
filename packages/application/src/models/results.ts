/**
 * @file results.ts
 * @module @workspace/application/models
 * @description Command and Query result models
 */

import { BookingStatusSchema } from "@workspace/domain/booking";
import { BookingId, Money, PnrCodeSchema } from "@workspace/domain/kernel";
import { Schema } from "effect";

// --- Inventory Service Results ---

export class HoldSeatsResult extends Schema.Class<HoldSeatsResult>(
	"HoldSeatsResult",
)({
	inventory: Schema.Unknown.pipe(
		Schema.annotations({ description: "Updated flight inventory" }),
	),
	totalPrice: Money,
	unitPrice: Money,
	seatsHeld: Schema.Number.pipe(Schema.int(), Schema.positive()),
	holdExpiresAt: Schema.Date,
}) {}

export class ReleaseSeatsResult extends Schema.Class<ReleaseSeatsResult>(
	"ReleaseSeatsResult",
)({
	inventory: Schema.Unknown.pipe(
		Schema.annotations({ description: "Updated flight inventory" }),
	),
	seatsReleased: Schema.Number.pipe(Schema.int(), Schema.positive()),
}) {}

// --- Booking Service Results ---

export class BookFlightResult extends Schema.Class<BookFlightResult>(
	"BookFlightResult",
)({
	bookingId: BookingId,
	pnrCode: PnrCodeSchema,
	status: BookingStatusSchema,
	totalPrice: Money,
	confirmedAt: Schema.Date,
}) {}
