/**
 * Property-Based Tests for Kernel Value Objects
 */

import { fc, test } from "@fast-check/vitest";
import { Schema } from "effect";
import { describe, expect } from "vitest";
import {
  AirportCodeSchema,
  type CurrencyCode,
  Money,
  Route,
  Schedule,
} from "./kernel.js";

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
  test.prop([arbMoney, arbMoney])(
    "Property 1: Adding money with same currency is commutative",
    (money1, money2) => {
      // Skip if different currencies
      if (money1.currency !== money2.currency) return;

      const sum1 = money1.add(money2);
      const sum2 = money2.add(money1);

      expect(sum1.amount).toBe(sum2.amount);
      expect(sum1.currency).toBe(sum2.currency);
    },
  );

  test.prop([arbMoney, arbMoney, arbMoney])(
    "Property 2: Adding money is associative",
    (money1, money2, money3) => {
      // Skip if different currencies
      if (
        money1.currency !== money2.currency ||
        money2.currency !== money3.currency
      )
        return;

      const sum1 = money1.add(money2).add(money3);
      const sum2 = money1.add(money2.add(money3));

      expect(sum1.amount).toBe(sum2.amount);
    },
  );

  test.prop([arbMoney, arbCurrency])(
    "Property 3: Adding zero is identity",
    (money, currency) => {
      // Skip if different currencies
      if (money.currency !== currency) return;

      const zero = Money.zero(currency as CurrencyCode);
      const result = money.add(zero);

      expect(result.amount).toBe(money.amount);
      expect(result.currency).toBe(money.currency);
    },
  );

  test.prop([arbMoney, fc.integer({ min: 0, max: 100 })])(
    "Property 4: Multiplying by factor scales amount",
    (money, factor) => {
      const result = money.multiply(factor);

      expect(result.amount).toBe(Math.round(money.amount * factor));
      expect(result.currency).toBe(money.currency);
    },
  );

  test.prop([arbMoney])("Property 5: Multiplying by 1 is identity", (money) => {
    const result = money.multiply(1);

    expect(result.amount).toBe(money.amount);
    expect(result.currency).toBe(money.currency);
  });

  test.prop([arbMoney])("Property 6: Multiplying by 0 gives zero", (money) => {
    const result = money.multiply(0);

    expect(result.amount).toBe(0);
    expect(result.currency).toBe(money.currency);
  });

  test.prop([arbMoney, arbMoney])(
    "Property 7: Cannot add money with different currencies",
    (money1, money2) => {
      // Skip if same currency
      if (money1.currency === money2.currency) return;

      expect(() => money1.add(money2)).toThrow();
    },
  );
});

describe("Route - Property-Based Tests", () => {
  test.prop([arbAirportCode, arbAirportCode])(
    "Property 1: Cannot create route with same origin and destination",
    (code1, code2) => {
      // Skip if different codes
      if (code1 !== code2) return;

      expect(() =>
        Route.create({
          origin: code1,
          destination: code2,
        }),
      ).toThrow();
    },
  );

  test.prop([arbAirportCode, arbAirportCode])(
    "Property 2: Valid routes have different origin and destination",
    (origin, destination) => {
      // Skip if same codes
      if (origin === destination) return;

      const route = Route.create({ origin, destination });

      expect(route.origin).toBe(origin);
      expect(route.destination).toBe(destination);
      expect(route.origin).not.toBe(route.destination);
    },
  );
});

describe("Schedule - Property-Based Tests", () => {
  test.prop([
    fc.date({ min: new Date("2024-01-01"), max: new Date("2025-12-31") }),
    fc.integer({ min: 1, max: 24 * 60 * 60 * 1000 }), // 1ms to 24 hours
  ])("Property 1: Arrival must be after departure", (departure, durationMs) => {
    const arrival = new Date(departure.getTime() + durationMs);
    const schedule = Schedule.create({ departure, arrival });

    expect(schedule.arrival.getTime()).toBeGreaterThan(
      schedule.departure.getTime(),
    );
  });

  test.prop([fc.date()])(
    "Property 2: Cannot create schedule with same departure and arrival",
    (time) => {
      expect(() =>
        Schedule.create({
          departure: time,
          arrival: time,
        }),
      ).toThrow();
    },
  );

  test.prop([
    fc.date({ min: new Date("2024-01-01"), max: new Date("2025-12-31") }),
    fc.integer({ min: 1, max: 1000 }),
  ])(
    "Property 3: Cannot create schedule with arrival before departure",
    (arrival, durationMs) => {
      const departure = new Date(arrival.getTime() + durationMs);

      expect(() =>
        Schedule.create({
          departure,
          arrival,
        }),
      ).toThrow();
    },
  );
});
