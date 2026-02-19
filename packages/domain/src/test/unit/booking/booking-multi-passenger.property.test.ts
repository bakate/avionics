/**
 * Property-Based Tests for Multi-Passenger Booking
 * Feature: multi-passenger-pricing
 */

import { fc } from "@fast-check/vitest";
import { Effect, Option as O } from "effect";
import { describe, expect, test } from "vitest";
import { Booking } from "../../../booking/booking.js";
import { Passenger, type PassengerId } from "../../../booking/passenger.js";
import { BookingSegment } from "../../../booking/segment.js";
import {
  type BookingId,
  type CabinClass,
  type CurrencyCode,
  type Email,
  type Gender,
  Money,
  makeFlightId,
  makeSegmentId,
  type PassengerType,
  type PnrCode,
} from "../../../kernel.js";
import { countSeatsNeeded } from "../../../pricing/pricing-engine.js";

// -----------------------------------------------------------------------------
// Arbitraries
// -----------------------------------------------------------------------------

const FIXED_NOW = new Date("2026-01-01T00:00:00Z").getTime();

const arbEmail = fc
  .tuple(
    fc.stringMatching(/^[a-z]{3,10}$/),
    fc.stringMatching(/^[a-z]{3,10}$/),
    fc.constantFrom("com", "org", "net"),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}` as Email);

const arbPassengerType = fc.constantFrom(
  "INFANT",
  "CHILD",
  "YOUNG_ADULT",
  "ADULT",
  "SENIOR",
) as fc.Arbitrary<PassengerType>;

const arbPassenger = fc
  .record({
    id: fc.uuid(),
    firstName: fc.string({ minLength: 2, maxLength: 20 }),
    lastName: fc.string({ minLength: 2, maxLength: 20 }),
    email: arbEmail,
    dateOfBirth: fc.date({
      min: new Date("1950-01-01"),
      max: new Date("2030-01-01"),
    }),
    gender: fc.constantFrom("MALE", "FEMALE") as fc.Arbitrary<Gender>,
    type: arbPassengerType,
  })
  .map(
    (props) =>
      new Passenger({
        ...props,
        id: props.id as PassengerId,
      }),
  );

const arbMoney = fc
  .record({
    amount: fc.integer({ min: 100, max: 10000 }),
    currency: fc.constantFrom("EUR", "USD", "GBP", "CHF"),
  })
  .map(({ amount, currency }) => Money.of(amount, currency as CurrencyCode));

const arbBookingSegment = fc
  .record({
    id: fc.uuid(),
    flightId: fc.string({ minLength: 5, maxLength: 10 }),
    cabin: fc.constantFrom("ECONOMY", "BUSINESS", "FIRST"),
    price: arbMoney,
    seatNumber: fc.option(fc.string({ minLength: 2, maxLength: 4 }), {
      nil: undefined,
    }),
  })
  .map(
    (props) =>
      new BookingSegment({
        id: makeSegmentId(props.id),
        flightId: makeFlightId(props.flightId),
        cabin: props.cabin as CabinClass,
        price: props.price,
        seatNumber: props.seatNumber ? O.some(props.seatNumber) : O.none(),
      }),
  );

// -----------------------------------------------------------------------------
// Property-Based Tests
// -----------------------------------------------------------------------------

describe("Booking Multi-Passenger - Property-Based Tests", () => {
  /**
   * Feature: multi-passenger-pricing, Property 1: Multi-passenger booking preserves all passengers
   */
  test("Property 1: For any non-empty array of passengers, Booking.create preserves all passengers in order", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.stringMatching(/^[A-Z0-9]{6}$/),
        fc.array(arbPassenger, { minLength: 1, maxLength: 9 }),
        fc.array(arbBookingSegment, { minLength: 1, maxLength: 2 }),
        (id, pnrCode, passengers, segments) => {
          const booking = Booking.create({
            id: id as BookingId,
            pnrCode: pnrCode as PnrCode,
            passengers: passengers as [Passenger, ...Array<Passenger>],
            segments: segments as [BookingSegment, ...Array<BookingSegment>],
            expiresAt: O.none(),
          });

          // Same count
          expect(booking.passengers.length).toBe(passengers.length);

          // Same passengers in same order
          for (const [i, original] of passengers.entries()) {
            const stored = booking.passengers[i];
            expect(stored).toBeDefined();
            if (!stored) return;
            expect(stored.id).toBe(original.id);
            expect(stored.firstName).toBe(original.firstName);
            expect(stored.lastName).toBe(original.lastName);
            expect(stored.type).toBe(original.type);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: multi-passenger-pricing, Property 6: Cancel releases correct seat count
   */
  test("Property 6: For any booking with mixed passenger types, cancel emits events with quantity = countSeatsNeeded", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.stringMatching(/^[A-Z0-9]{6}$/),
        fc.array(arbPassenger, { minLength: 1, maxLength: 9 }),
        fc.array(arbBookingSegment, { minLength: 1, maxLength: 2 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        async (id, pnrCode, passengers, segments, reason) => {
          const booking = Booking.create({
            id: id as BookingId,
            pnrCode: pnrCode as PnrCode,
            passengers: passengers as [Passenger, ...Array<Passenger>],
            segments: segments as [BookingSegment, ...Array<BookingSegment>],
            expiresAt: O.none(),
          });

          const expectedSeats = countSeatsNeeded(passengers);

          const cancelled = await Effect.runPromise(
            booking.cancel(reason, new Date(FIXED_NOW)),
          );

          // Find the BookingCancelled event
          const cancelEvent = cancelled.domainEvents.find(
            (e) => "_tag" in e && e._tag === "BookingCancelled",
          );

          expect(cancelEvent).toBeDefined();
          if (!cancelEvent || !("segments" in cancelEvent)) return;

          // Every segment in the event should have quantity = countSeatsNeeded
          for (const seg of cancelEvent.segments) {
            expect(seg.quantity).toBe(expectedSeats);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
