/**
 * Property-Based Tests for Kernel Value Objects
 */

import { fc } from "@fast-check/vitest";
import { Schema } from "effect";
import { describe, expect, test } from "vitest";
import {
  AirportCodeSchema,
  type CurrencyCode,
  Money,
  Route,
  Schedule,
} from "../../kernel.js";

// Arbitraries
const arbCurrency = fc.constantFrom("EUR", "USD", "GBP", "CHF");

const arbMoney = fc
  .record({
    amount: fc.integer({ min: 0, max: 1000000 }),
    currency: arbCurrency,
  })
  .map(({ amount, currency }) => Money.of(amount, currency as CurrencyCode));

const arbAirportCode = fc
  .stringMatching(/^[A-Z]{3}$/)
  .map((code) => Schema.decodeSync(AirportCodeSchema)(code));

describe("Money - Property-Based Tests", () => {
  test("Property 1: Adding money with same currency is commutative", () => {
    fc.assert(
      fc.property(arbMoney, arbMoney, (money1, money2) => {
        // Skip if different currencies
        if (money1.currency !== money2.currency) return;

        const sum1 = money1.add(money2);
        const sum2 = money2.add(money1);

        expect(sum1.amount).toBe(sum2.amount);
        expect(sum1.currency).toBe(sum2.currency);
      }),
    );
  });

  test("Property 2: Adding money is associative", () => {
    fc.assert(
      fc.property(arbMoney, arbMoney, arbMoney, (money1, money2, money3) => {
        // Skip if different currencies
        if (
          money1.currency !== money2.currency ||
          money2.currency !== money3.currency
        )
          return;

        const sum1 = money1.add(money2).add(money3);
        const sum2 = money1.add(money2.add(money3));

        expect(sum1.amount).toBe(sum2.amount);
      }),
    );
  });

  test("Property 3: Adding zero is identity", () => {
    fc.assert(
      fc.property(arbMoney, arbCurrency, (money, currency) => {
        // Skip if different currencies
        if (money.currency !== currency) return;

        const zero = Money.zero(currency as CurrencyCode);
        const result = money.add(zero);

        expect(result.amount).toBe(money.amount);
        expect(result.currency).toBe(money.currency);
      }),
    );
  });

  test("Property 4: Multiplying by factor scales amount", () => {
    fc.assert(
      fc.property(
        arbMoney,
        fc.integer({ min: 0, max: 100 }),
        (money, factor) => {
          const result = money.multiply(factor);

          expect(result.amount).toBe(Math.round(money.amount * factor));
          expect(result.currency).toBe(money.currency);
        },
      ),
    );
  });

  test("Property 5: Multiplying by 1 is identity", () => {
    fc.assert(
      fc.property(arbMoney, (money) => {
        const result = money.multiply(1);

        expect(result.amount).toBe(money.amount);
        expect(result.currency).toBe(money.currency);
      }),
    );
  });

  test("Property 6: Multiplying by 0 gives zero", () => {
    fc.assert(
      fc.property(arbMoney, (money) => {
        const result = money.multiply(0);

        expect(result.amount).toBe(0);
        expect(result.currency).toBe(money.currency);
      }),
    );
  });

  test("Property 7: Cannot add money with different currencies", () => {
    fc.assert(
      fc.property(arbMoney, arbMoney, (money1, money2) => {
        // Skip if same currency
        if (money1.currency === money2.currency) return;

        expect(() => money1.add(money2)).toThrow();
      }),
    );
  });
});

describe("Route - Property-Based Tests", () => {
  test("Property 1: Cannot create route with same origin and destination", () => {
    fc.assert(
      fc.property(arbAirportCode, arbAirportCode, (code1, code2) => {
        // Skip if different codes
        if (code1 !== code2) return;

        expect(() =>
          Route.create({
            origin: code1,
            destination: code2,
          }),
        ).toThrow();
      }),
    );
  });

  test("Property 2: Valid routes have different origin and destination", () => {
    fc.assert(
      fc.property(arbAirportCode, arbAirportCode, (origin, destination) => {
        // Skip if same codes
        if (origin === destination) return;

        const route = Route.create({ origin, destination });

        expect(route.origin).toBe(origin);
        expect(route.destination).toBe(destination);
        expect(route.origin).not.toBe(route.destination);
      }),
    );
  });
});

describe("Schedule - Property-Based Tests", () => {
  test("Property 1: Arrival must be after departure", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2024-01-01"), max: new Date("2025-12-31") }),
        fc.integer({ min: 1, max: 24 * 60 * 60 * 1000 }), // 1ms to 24 hours
        (departure, durationMs) => {
          const arrival = new Date(departure.getTime() + durationMs);
          const schedule = Schedule.create({ departure, arrival });

          expect(schedule.arrival.getTime()).toBeGreaterThan(
            schedule.departure.getTime(),
          );
        },
      ),
    );
  });

  test("Property 2: Cannot create schedule with same departure and arrival", () => {
    fc.assert(
      fc.property(fc.date(), (time) => {
        expect(() =>
          Schedule.create({
            departure: time,
            arrival: time,
          }),
        ).toThrow();
      }),
    );
  });

  test("Property 3: Cannot create schedule with arrival before departure", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2024-01-01"), max: new Date("2025-12-31") }),
        fc.integer({ min: 1, max: 1000 }),
        (arrival, durationMs) => {
          const departure = new Date(arrival.getTime() + durationMs);

          expect(() =>
            Schedule.create({
              departure,
              arrival,
            }),
          ).toThrow();
        },
      ),
    );
  });
});
