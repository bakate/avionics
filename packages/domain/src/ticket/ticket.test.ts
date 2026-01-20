import { faker } from "@faker-js/faker";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { Ticket, TicketStatus } from "./ticket.js";

describe("Ticket Domain Model", () => {
	it("should create a valid ticket", () => {
		const ticket = Schema.decodeUnknownSync(Ticket)({
			ticketNumber: faker.string.numeric(13),
			pnrCode: faker.string.alphanumeric({ length: 6, casing: "upper" }),
			status: TicketStatus.ISSUED,
			passengerId: faker.string.uuid(),
			passengerName: faker.person.fullName().toUpperCase(),
			coupons: [
				{
					couponNumber: faker.number.int({ min: 1, max: 999999 }),
					flightId: `FL-${faker.number.int({ min: 100, max: 999 })}`,
					seatNumber: `${faker.number.int({ min: 1, max: 30 })}${faker.string.alpha({ length: 1, casing: "upper" })}`,
					status: "OPEN",
				},
			],
			issuedAt: new Date().toISOString(),
		});

		expect(ticket.status).toBe("ISSUED");
		expect(ticket.ticketNumber).toHaveLength(13);
	});

	it("should fail validation for invalid ticket number", () => {
		const makeInvalid = () =>
			Schema.decodeUnknownSync(Ticket)({
				ticketNumber: faker.string.numeric(10), // Too short
				pnrCode: faker.string.alphanumeric({ length: 6, casing: "upper" }),
				status: TicketStatus.ISSUED,
				passengerId: faker.string.uuid(),
				passengerName: faker.person.fullName(),
				coupons: [
					{
						couponNumber: 1,
						flightId: "FL-123",
						seatNumber: "12A",
						status: "OPEN",
					},
				],
				issuedAt: new Date().toISOString(),
			});

		expect(makeInvalid).toThrow();
	});
});
