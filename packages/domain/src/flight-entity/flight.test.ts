import { faker } from "@faker-js/faker";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { Flight } from "./flight.js";

describe("Flight Domain Model", () => {
	it("should create a valid flight", () => {
		const departure = new Date();
		const arrival = faker.date.future({ refDate: departure });

		const flight = Schema.decodeUnknownSync(Flight, {
			exact: true,
			onExcessProperty: "error",
		})({
			id: `FL-${faker.number.int({ min: 100, max: 999 })}`,
			flightNumber: `${faker.string.alpha({ length: 2, casing: "upper" })}${faker.number.int({ min: 100, max: 9999 })}`,
			route: {
				origin: faker.string.alpha({ length: 3, casing: "upper" }),
				destination: faker.string.alpha({ length: 3, casing: "upper" }),
			},
			schedule: {
				departure: departure.toISOString(),
				arrival: arrival.toISOString(),
			},
		});

		expect(flight.id).toBeDefined();
	});

	it("should fail validation if arrival is before departure", () => {
		const now = new Date();
		const past = new Date(now.getTime() - 10000);

		const makeInvalidFlight = () =>
			Schema.decodeUnknownSync(Flight, {
				exact: true,
				onExcessProperty: "error",
			})({
				id: "FL-123",
				flightNumber: "AF123",
				route: { origin: "CDG", destination: "JFK" },
				schedule: {
					departure: now.toISOString(),
					arrival: past.toISOString(),
				},
			});

		expect(makeInvalidFlight).toThrow("Arrival must be after departure");
	});
});
