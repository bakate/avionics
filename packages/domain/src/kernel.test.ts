import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { AirportCodeSchema, Money, Route, Schedule } from "./kernel.js";

const makeCode = Schema.decodeSync(AirportCodeSchema);

describe("Shared Kernel", () => {
	describe("Route", () => {
		it("should create a valid route", () => {
			const route = Route.create({
				origin: makeCode("CDG"),
				destination: makeCode("JFK"),
			});
			expect(route.origin).toBe("CDG");
			expect(route.destination).toBe("JFK");
		});

		it("should throw if origin and destination are the same", () => {
			expect(() =>
				Route.create({
					origin: makeCode("LHR"),
					destination: makeCode("LHR"),
				}),
			).toThrow("Origin and Destination must be different");
		});
	});
	describe("Schedule", () => {
		it("should create a valid schedule from Date objects", () => {
			const departure = new Date();
			const arrival = new Date(departure.getTime() + 3600 * 1000); // +1 hour
			const schedule = Schedule.create({ departure, arrival });
			expect(schedule.departure).toEqual(departure);
			expect(schedule.arrival).toEqual(arrival);
		});

		it("should throw if arrival is before departure", () => {
			const departure = new Date();
			const arrival = new Date(departure.getTime() - 1000); // -1 second
			expect(() => Schedule.create({ departure, arrival })).toThrow(
				"Arrival must be after departure",
			);
		});

		it("should throw if arrival is same as departure (strictly greater check)", () => {
			// The filter is `s.arrival > s.departure`
			const time = new Date();
			expect(() => Schedule.create({ departure: time, arrival: time })).toThrow(
				"Arrival must be after departure",
			);
		});
	});

	describe("Money", () => {
		it("should create zero money with valid currency", () => {
			const money = Money.zero("USD");
			expect(money.amount).toBe(0);
			expect(money.currency).toBe("USD");
		});

		it("should throw error properly with invalid currency", () => {
			expect(() => Money.zero("usd")).toThrow();
			expect(() => Money.zero("US")).toThrow();
			expect(() => Money.zero("USDA")).toThrow();
		});
	});
});
