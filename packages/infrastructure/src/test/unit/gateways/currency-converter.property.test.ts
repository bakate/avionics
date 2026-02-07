/**
 * @file currency-converter.property.test.ts
 * @module @workspace/infrastructure/test
 * @description Property tests for CurrencyConverterGateway behavior
 *
 * Tests validate the core business logic:
 * - Property 1: Same-currency identity
 * - Property 2: Invalid currency rejection
 * - Property 3: Valid conversion produces non-zero result
 *
 *
 * Note: These tests use a mock implementation to test the port contract.
 * Integration tests with the real implementation are in integration/.
 */

import { test } from "@fast-check/vitest";
import {
  CurrencyApiUnavailableError,
  type CurrencyConversionError,
  CurrencyConverterGateway,
} from "@workspace/application/currency-converter.gateway";
import { CurrencyMismatchError } from "@workspace/domain/errors";
import {
  type CurrencyCode,
  Money,
  SupportedCurrencies,
} from "@workspace/domain/kernel";
import { Effect, Layer } from "effect";
import fc from "fast-check";
import { describe, expect } from "vitest";
import { isValidCurrency } from "../../../gateways/currency-converter.gateway";

// ============================================================================
// Test Constants
// ============================================================================

/**
 * Using domain-defined currencies: EUR, USD, GBP, CHF
 */
const VALID_CURRENCIES = SupportedCurrencies;

const INVALID_CURRENCIES = ["XXX", "ABC", "ZZZ", "JPY"]; // JPY is not in domain

// ============================================================================
// Property Definitions
// ============================================================================

const PROPERTIES = {
  SAME_CURRENCY_IDENTITY: {
    number: 1,
    text: "Same-currency identity",
  },
  INVALID_CURRENCY_REJECTION: {
    number: 2,
    text: "Invalid currency rejection",
  },
  VALID_CONVERSION_NON_ZERO: {
    number: 3,
    text: "Valid conversion produces non-zero result",
  },
} as const;

// ============================================================================
// Mock Implementation
// ============================================================================

/**
 * Mock exchange rates (relative to EUR)
 */
const MOCK_EXCHANGE_RATES: Record<CurrencyCode, number> = {
  EUR: 1.0,
  USD: 1.1,
  GBP: 0.85,
  CHF: 0.95,
};

/**
 * Mock gateway that implements the core conversion logic
 * without rate limiting, caching, or HTTP calls
 */
const mockConvert = (
  money: Money,
  toCurrency: CurrencyCode,
): Effect.Effect<Money, CurrencyConversionError> =>
  Effect.gen(function* () {
    const fromCurrency = money.currency;

    // Same-currency identity
    if (fromCurrency === toCurrency) {
      return money;
    }

    // Validate currencies
    if (!isValidCurrency(toCurrency)) {
      return yield* Effect.fail(
        new CurrencyMismatchError({
          expected: SupportedCurrencies.join(", "),
          actual: toCurrency,
        }),
      );
    }

    // Get rates
    const fromRate = MOCK_EXCHANGE_RATES[fromCurrency];
    const toRate = MOCK_EXCHANGE_RATES[toCurrency];

    if (fromRate === undefined || toRate === undefined) {
      return yield* Effect.fail(
        new CurrencyApiUnavailableError({
          message: `Rate not found for ${fromCurrency} to ${toCurrency}`,
        }),
      );
    }

    // Convert: amount in EUR * target rate
    const amountInEur = money.amount / fromRate;
    const convertedAmount = Math.round(amountInEur * toRate * 100) / 100;

    return Money.of(convertedAmount, toCurrency);
  });

/**
 * Test Layer with mock implementation
 */
const MockCurrencyConverterLayer = Layer.succeed(CurrencyConverterGateway, {
  convert: mockConvert,
});

// ============================================================================
// Arbitraries
// ============================================================================

const validCurrencyArb = fc.constantFrom(...VALID_CURRENCIES);

const invalidCurrencyArb = fc.constantFrom(...INVALID_CURRENCIES);

const positiveAmountArb = fc
  .integer({
    min: 1,
    max: 1_000_000_00, // 1 million units
  })
  .map((n) => n / 100);

// ============================================================================
// Property Tests
// ============================================================================

describe("CurrencyConverterGateway Property Tests", () => {
  // Tag: Feature: infrastructure-layer, Property 1: Same-currency identity
  test.prop([validCurrencyArb, positiveAmountArb], { numRuns: 50 })(
    `Property ${PROPERTIES.SAME_CURRENCY_IDENTITY.number}: ${PROPERTIES.SAME_CURRENCY_IDENTITY.text}`,
    async (currency, amount) => {
      const money = Money.of(amount, currency);

      const program = Effect.gen(function* () {
        const gateway = yield* CurrencyConverterGateway;
        return yield* gateway.convert(money, currency);
      });

      const result = await Effect.runPromise(
        Effect.provide(program, MockCurrencyConverterLayer),
      );

      // Same currency should return identical money
      expect(result.amount).toEqual(money.amount);
      expect(result.currency).toEqual(money.currency);
    },
  );

  // Tag: Feature: infrastructure-layer, Property 2: Invalid currency rejection
  test.prop([invalidCurrencyArb, positiveAmountArb], { numRuns: 50 })(
    `Property ${PROPERTIES.INVALID_CURRENCY_REJECTION.number}: ${PROPERTIES.INVALID_CURRENCY_REJECTION.text}`,
    async (invalidCurrency, amount) => {
      const money = Money.of(amount, "EUR");

      const program = Effect.gen(function* () {
        const gateway = yield* CurrencyConverterGateway;
        return yield* gateway.convert(
          money,
          invalidCurrency as unknown as CurrencyCode,
        );
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, MockCurrencyConverterLayer),
      );

      // Should fail with CurrencyMismatchError
      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        expect(result.cause._tag).toBe("Fail");
      }
    },
  );

  // Tag: Feature: infrastructure-layer, Property 3: Valid conversion produces non-zero result
  test.prop([validCurrencyArb, validCurrencyArb, positiveAmountArb], {
    numRuns: 50,
  })(
    `Property ${PROPERTIES.VALID_CONVERSION_NON_ZERO.number}: ${PROPERTIES.VALID_CONVERSION_NON_ZERO.text}`,
    async (fromCurrency, toCurrency, amount) => {
      // Skip same currency - tested in Property 1
      if (fromCurrency === toCurrency) return;

      const money = Money.of(amount, fromCurrency);

      const program = Effect.gen(function* () {
        const gateway = yield* CurrencyConverterGateway;
        return yield* gateway.convert(money, toCurrency);
      });

      const result = await Effect.runPromise(
        Effect.provide(program, MockCurrencyConverterLayer),
      );

      // Converted amount should be positive
      expect(result.amount).toBeGreaterThan(0);
      // Currency should match target
      expect(result.currency).toBe(toCurrency);
    },
  );

  // Tag: Feature: infrastructure-layer, Property 35: Conversion round-trip preserves approximate value
  test.prop([validCurrencyArb, validCurrencyArb, positiveAmountArb], {
    numRuns: 20,
  })(
    "Property 35: Conversion round-trip preserves approximate value",
    async (fromCurrency, toCurrency, amount) => {
      if (fromCurrency === toCurrency) return;

      const originalMoney = Money.of(amount, fromCurrency);

      const program = Effect.gen(function* () {
        const gateway = yield* CurrencyConverterGateway;

        // Convert from -> to
        const converted = yield* gateway.convert(originalMoney, toCurrency);
        // Convert back to -> from
        const roundTrip = yield* gateway.convert(converted, fromCurrency);

        return roundTrip;
      });

      const result = await Effect.runPromise(
        Effect.provide(program, MockCurrencyConverterLayer),
      );

      // Round-trip should be approximately equal (within floating point tolerance)
      // Using 3 decimal places of precision (approx 0.0005) to handle floating point errors
      expect(result.amount).toBeCloseTo(originalMoney.amount, 3);
      expect(result.currency).toBe(fromCurrency);
    },
  );
});
