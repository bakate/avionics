import { Effect, Option as O, Schema } from "effect";
import { BookingExpiredError, BookingStatusError } from "../errors.js";
import {
	BookingCancelled,
	BookingConfirmed,
	BookingCreated,
	BookingExpired,
	type EventId,
} from "../events.js";
import { BookingId, PnrCodeSchema } from "../kernel.js";

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

// --- Booking Aggregate Root ---
export class Booking extends Schema.Class<Booking>("Booking")({
	id: BookingId,
	pnrCode: PnrCodeSchema,
	status: BookingStatusSchema,
	passengers: Schema.NonEmptyArray(Passenger),
	segments: Schema.NonEmptyArray(BookingSegment),
	expiresAt: Schema.Option(Schema.Date), // Expiration of the HOLD
	createdAt: Schema.Date,
	domainEvents: Schema.Array(Schema.Unknown).pipe(
		Schema.annotations({
			description: "Domain events raised by this aggregate",
		}),
	),
	version: Schema.Number,
}) {
	isPayable(): boolean {
		return (
			this.status === PnrStatus.HELD || this.status === PnrStatus.CONFIRMED
		);
	}

	isExpired(): boolean {
		return O.match(this.expiresAt, {
			onNone: () => false,
			onSome: (exp) => exp < new Date(),
		});
	}

	// Factory method for creating new bookings
	static create(props: {
		id: BookingId;
		pnrCode: typeof PnrCodeSchema.Type;
		passengers: [Passenger, ...Passenger[]];
		segments: [BookingSegment, ...BookingSegment[]];
		expiresAt: O.Option<Date>;
	}): Booking {
		const now = new Date();
		const booking = new Booking({
			...props,
			status: PnrStatus.HELD,
			createdAt: now,
			domainEvents: [],
			version: 1,
		});

		const event = new BookingCreated({
			eventId: `evt-${crypto.randomUUID()}` as EventId,
			occurredAt: now,
			aggregateId: props.id,
			aggregateType: "Booking",
			bookingId: props.id,
			pnrCode: props.pnrCode,
		});

		return new Booking({
			...booking,
			domainEvents: [event],
		});
	}

	// State transition: Confirm booking
	confirm(): Effect.Effect<Booking, BookingStatusError | BookingExpiredError> {
		return Effect.gen(this, function* () {
			if (this.isExpired()) {
				return yield* Effect.fail(
					new BookingExpiredError({
						pnrCode: this.pnrCode,
						expiresAt: O.getOrThrow(this.expiresAt),
					}),
				);
			}

			if (this.status !== PnrStatus.HELD) {
				return yield* Effect.fail(
					new BookingStatusError({
						pnrCode: this.pnrCode,
						status: this.status,
						expected: PnrStatus.HELD,
					}),
				);
			}

			const event = new BookingConfirmed({
				eventId: `evt-${crypto.randomUUID()}` as EventId,
				occurredAt: new Date(),
				aggregateId: this.id,
				aggregateType: "Booking",
				bookingId: this.id,
				pnrCode: this.pnrCode,
			});

			return new Booking({
				...this,
				status: PnrStatus.CONFIRMED,
				expiresAt: O.none(),
				domainEvents: [...this.domainEvents, event],
			});
		});
	}

	// State transition: Cancel booking
	cancel(reason: string): Effect.Effect<Booking, BookingStatusError> {
		return Effect.gen(this, function* () {
			if (
				this.status === PnrStatus.CANCELLED ||
				this.status === PnrStatus.EXPIRED
			) {
				return yield* Effect.fail(
					new BookingStatusError({
						pnrCode: this.pnrCode,
						status: this.status,
						expected: `${PnrStatus.HELD} or ${PnrStatus.CONFIRMED}`,
					}),
				);
			}

			const event = new BookingCancelled({
				eventId: `evt-${crypto.randomUUID()}` as EventId,
				occurredAt: new Date(),
				aggregateId: this.id,
				aggregateType: "Booking",
				bookingId: this.id,
				pnrCode: this.pnrCode,
				reason,
			});

			return new Booking({
				...this,
				status: PnrStatus.CANCELLED,
				expiresAt: O.none(),
				domainEvents: [...this.domainEvents, event],
			});
		});
	}

	// Mark as expired
	markExpired(): Booking {
		return O.match(this.expiresAt, {
			onNone: () => this,
			onSome: (expiredAt) => {
				const event = new BookingExpired({
					eventId: `evt-${crypto.randomUUID()}` as EventId,
					occurredAt: new Date(),
					aggregateId: this.id,
					aggregateType: "Booking",
					bookingId: this.id,
					pnrCode: this.pnrCode,
					expiredAt: expiredAt,
				});

				return new Booking({
					...this,
					status: PnrStatus.EXPIRED,
					domainEvents: [...this.domainEvents, event],
				});
			},
		});
	}

	// Clear events after publishing
	clearEvents(): Booking {
		return new Booking({
			...this,
			domainEvents: [],
		});
	}
}
