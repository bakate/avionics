/**
 * Property-Based Tests for Booking Aggregate
 * These tests verify state transition properties
 */

import { fc, test } from "@fast-check/vitest";
import { Effect, Option as O } from "effect";
import { describe, expect } from "vitest";
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
} from "../kernel.js";
import { Booking, PnrStatus } from "./booking.js";
import { Passenger, type PassengerId } from "./passenger.js";
import { BookingSegment } from "./segment.js";

// -----------------------------------------------------------------------------
// Arbitraries
// -----------------------------------------------------------------------------

const arbEmail = fc
  .tuple(
    fc.stringMatching(/^[a-z]{3,10}$/),
    fc.stringMatching(/^[a-z]{3,10}$/),
    fc.constantFrom("com", "org", "net"),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}` as Email);

const arbPassenger = fc
  .record({
    id: fc.uuid(),
    firstName: fc.string({ minLength: 2, maxLength: 20 }),
    lastName: fc.string({ minLength: 2, maxLength: 20 }),
    email: arbEmail,
    dateOfBirth: fc.date({ min: new Date("1950-01-01"), max: new Date() }),
    gender: fc.constantFrom("MALE", "FEMALE") as fc.Arbitrary<Gender>,
    type: fc.constantFrom(
      "ADULT",
      "CHILD",
      "SENIOR",
    ) as fc.Arbitrary<PassengerType>,
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
  })
  .map(
    (props) =>
      new BookingSegment({
        id: makeSegmentId(props.id),
        flightId: makeFlightId(props.flightId),
        cabin: props.cabin as CabinClass,
        price: props.price,
      }),
  );

const arbBooking = fc
  .record({
    id: fc.uuid(),
    pnrCode: fc.stringMatching(/^[A-Z0-9]{6}$/),
    passengers: fc.array(arbPassenger, { minLength: 1, maxLength: 3 }),
    segments: fc.array(arbBookingSegment, { minLength: 1, maxLength: 2 }),
    expiresAt: fc.option(
      fc
        .integer({ min: 1000, max: 3600000 })
        .map((offset) => new Date(Date.now() + offset)),
      { nil: undefined },
    ),
  })
  .map((props) =>
    Booking.create({
      id: props.id as BookingId,
      pnrCode: props.pnrCode as PnrCode,
      passengers: props.passengers as [Passenger, ...Passenger[]],
      segments: props.segments as [BookingSegment, ...BookingSegment[]],
      expiresAt: props.expiresAt ? O.some(props.expiresAt) : O.none(),
    }),
  );

// -----------------------------------------------------------------------------
// Property-Based Tests
// -----------------------------------------------------------------------------

describe("Booking - Property-Based Tests", () => {
  test.prop([arbBooking])(
    "Property 1: New bookings start in HELD status",
    (booking) => {
      expect(booking.status).toBe(PnrStatus.HELD);
    },
  );

  test.prop([arbBooking])(
    "Property 2: Confirming a HELD booking transitions to CONFIRMED",
    async (booking) => {
      const program = Effect.gen(function* () {
        const confirmed = yield* booking.confirm();
        return confirmed.status === PnrStatus.CONFIRMED;
      });

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    },
  );

  test.prop([arbBooking])(
    "Property 3: Confirmed bookings have no expiration",
    async (booking) => {
      const program = Effect.gen(function* () {
        const confirmed = yield* booking.confirm();
        return O.isNone(confirmed.expiresAt);
      });

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    },
  );

  test.prop([arbBooking, fc.string({ minLength: 5, maxLength: 50 })])(
    "Property 4: Cancelling a booking transitions to CANCELLED",
    async (booking, reason) => {
      const program = Effect.gen(function* () {
        const cancelled = yield* booking.cancel(reason);
        return cancelled.status === PnrStatus.CANCELLED;
      });

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    },
  );

  test.prop([arbBooking])(
    "Property 5: Domain events are emitted on creation",
    (booking) => {
      expect(booking.domainEvents.length).toBeGreaterThan(0);
    },
  );

  test.prop([arbBooking])(
    "Property 6: State transitions emit domain events",
    async (booking) => {
      const program = Effect.gen(function* () {
        const initialEventCount = booking.domainEvents.length;
        const confirmed = yield* booking.confirm();
        return confirmed.domainEvents.length > initialEventCount;
      });

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    },
  );

  test.prop([arbBooking])(
    "Property 7: Expired bookings cannot be confirmed",
    async (booking) => {
      // Create an expired booking
      const expiredBooking = new Booking({
        ...booking,
        expiresAt: O.some(new Date(Date.now() - 1000)), // 1 second ago
      });

      const program = expiredBooking.confirm().pipe(
        Effect.map(() => false), // Should not succeed
        Effect.catchTag("BookingExpiredError", () => Effect.succeed(true)),
      );

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    },
  );

  test.prop([arbBooking])(
    "Property 8: Booking is payable when HELD or CONFIRMED",
    async (booking) => {
      const program = Effect.gen(function* () {
        // HELD booking should be payable
        const heldPayable = booking.isPayable();

        // CONFIRMED booking should be payable
        const confirmed = yield* booking.confirm();
        const confirmedPayable = confirmed.isPayable();

        return heldPayable && confirmedPayable;
      });

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    },
  );

  test.prop([arbBooking, fc.string()])(
    "Property 9: Cancelled bookings are not payable",
    async (booking, reason) => {
      const program = Effect.gen(function* () {
        const cancelled = yield* booking.cancel(reason);
        return !cancelled.isPayable();
      });

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    },
  );

  test.prop([arbBooking])(
    "Property 10: Clearing events removes all domain events",
    (booking) => {
      const cleared = booking.clearEvents();
      expect(cleared.domainEvents.length).toBe(0);
    },
  );
});
