import { Booking, PnrStatus } from "@workspace/domain/booking";
import { InventoryPersistenceError } from "@workspace/domain/errors";
import {
	BookingId,
	EmailSchema,
	Money,
	makeFlightId,
	PnrCodeSchema,
} from "@workspace/domain/kernel";
import { Passenger, PassengerId } from "@workspace/domain/passenger";
import { BookingSegment } from "@workspace/domain/segment";
import { Effect, Layer, Option as O, Ref, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import { ReleaseSeatsResult } from "../models/results.js";
import { UnitOfWork } from "../ports/unit-of-work.js";
import { BookingRepository } from "../repositories/booking.repository.js";
import { CancellationService } from "./cancellation.service.js";
import { InventoryService } from "./inventory.service.js";

const makeExpiredBooking = (pnr: string, flightId = "FL-123") => {
	const passenger = new Passenger({
		id: PassengerId.make("pass-1"),
		firstName: "John",
		lastName: "Doe",
		email: Schema.decodeSync(EmailSchema)("john@example.com"),
		dateOfBirth: new Date(1990, 1, 1),
		gender: "MALE",
		type: "ADULT",
	});

	const segment = new BookingSegment({
		flightId: makeFlightId(flightId),
		cabin: "ECONOMY",
		price: Money.of(100, "EUR"),
	});

	return Booking.create({
		id: BookingId.make(`book-${pnr}`),
		pnrCode: Schema.decodeSync(PnrCodeSchema)(pnr),
		passengers: [passenger],
		segments: [segment],
		expiresAt: O.some(new Date(Date.now() - 1000)), // Expired 1s ago
	});
};

describe("CancellationService", () => {
	it("should process expired bookings and release seats", async () => {
		const expiredBooking = makeExpiredBooking("EXP001");
		let releaseSeatsCalled = false;
		let bookingSaved = false;

		const MockInventoryService = InventoryService.Test({
			releaseSeats: (params) => {
				releaseSeatsCalled = true;
				return Effect.succeed(
					new ReleaseSeatsResult({
						inventory: {}, // Mock inventory
						seatsReleased: params.numberOfSeats,
					}),
				);
			},
		});

		const MockBookingRepo = Layer.succeed(
			BookingRepository,
			BookingRepository.of({
				findExpired: () => Effect.succeed([expiredBooking]),
				save: (b) => {
					bookingSaved = true;
					expect(b.status).toBe(PnrStatus.EXPIRED);
					return Effect.succeed(b);
				},
				findById: () => Effect.die("Not implemented"),
				findByPnr: () => Effect.die("Not implemented"),
				findByPassengerId: () => Effect.die("Not implemented"),
			}),
		);

		const MockUnitOfWork = Layer.succeed(
			UnitOfWork,
			UnitOfWork.of({
				transaction: (eff) => eff,
			}),
		);

		const program = Effect.gen(function* () {
			const service = yield* CancellationService;
			yield* service.processExpirations();
		}).pipe(
			Effect.provide(CancellationService.Live),
			Effect.provide(MockInventoryService),
			Effect.provide(MockBookingRepo),
			Effect.provide(MockUnitOfWork),
		);

		await Effect.runPromise(program);

		expect(releaseSeatsCalled).toBe(true);
		expect(bookingSaved).toBe(true);
	});

	it("should continue processing if one booking fails", async () => {
		const booking1 = makeExpiredBooking("EXP001", "FL-1");
		const booking2 = makeExpiredBooking("EXP002", "FL-2");
		const processedPnrs: string[] = [];

		const MockInventoryService = InventoryService.Test({
			releaseSeats: (params) => {
				if (params.flightId === booking1.segments[0].flightId) {
					return Effect.fail(
						new InventoryPersistenceError({
							flightId: params.flightId,
							reason: "Inventory Error",
						}),
					);
				}
				return Effect.succeed(
					new ReleaseSeatsResult({
						inventory: {}, // Mock inventory
						seatsReleased: params.numberOfSeats,
					}),
				);
			},
		});

		const MockBookingRepo = Layer.succeed(
			BookingRepository,
			BookingRepository.of({
				findExpired: () => Effect.succeed([booking1, booking2]),
				save: (b) => {
					processedPnrs.push(b.pnrCode);
					return Effect.succeed(b);
				},
				findById: () => Effect.die("Not implemented"),
				findByPnr: () => Effect.die("Not implemented"),
				findByPassengerId: () => Effect.die("Not implemented"),
			}),
		);

		const MockUnitOfWork = Layer.succeed(
			UnitOfWork,
			UnitOfWork.of({
				transaction: (eff) => eff,
			}),
		);

		const program = Effect.gen(function* () {
			const service = yield* CancellationService;
			yield* service.processExpirations();
		}).pipe(
			Effect.provide(CancellationService.Live),
			Effect.provide(MockInventoryService),
			Effect.provide(MockBookingRepo),
			Effect.provide(MockUnitOfWork),
		);

		await Effect.runPromise(program);

		// booking1 failed but booking2 should be processed
		expect(processedPnrs).toContain("EXP002");
		expect(processedPnrs).not.toContain("EXP001");
	});
});
