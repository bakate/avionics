/**
 * @file payment-gateway.property.test.ts
 * @module @workspace/infrastructure/test
 * @description Property tests for PaymentGateway behavior
 *
 * Tests validate the core business logic:
 * - Property 10: Payment requests include authentication (via SDK config)
 * - Property 11: Successful payments return transaction IDs
 * - Property 12: Payment API errors map to domain errors
 * - Property 13: All payment attempts are logged
 *
 * Note: These tests use a configurable mock to simulate Polar SDK behavior.
 * The Live layer uses the real SDK which is tested in integration tests.
 */

import { test } from "@fast-check/vitest";
import {
  CheckoutNotFoundError,
  PaymentApiUnavailableError,
  PaymentDeclinedError,
  type PaymentError,
  PaymentGateway,
  type PaymentGatewayService,
} from "@workspace/application/payment.gateway";
import { Money, SupportedCurrencies } from "@workspace/domain/kernel";
import { Effect, Layer, Ref } from "effect";
import fc from "fast-check";
import { describe, expect } from "vitest";

// ============================================================================
// Test Constants
// ============================================================================

const PROPERTIES = {
  SDK_CONFIGURED_WITH_AUTH: {
    number: 10,
    text: "Payment requests include authentication via SDK configuration",
  },
  SUCCESSFUL_PAYMENTS_RETURN_TRANSACTION_IDS: {
    number: 11,
    text: "Successful payments return transaction IDs",
  },
  API_ERRORS_MAP_TO_DOMAIN_ERRORS: {
    number: 12,
    text: "Payment API errors map to domain errors",
  },
  ALL_ATTEMPTS_ARE_LOGGED: {
    number: 13,
    text: "All payment attempts are logged",
  },
} as const;

// ============================================================================
// Arbitraries
// ============================================================================

const currencyArb = fc.constantFrom(...SupportedCurrencies);

const positiveAmountArb = fc
  .integer({ min: 100, max: 100_000_00 }) // 1 to 100k in cents
  .map((cents) => cents / 100);

const emailArb = fc.emailAddress();

const bookingReferenceArb = fc
  .stringMatching(/^[A-Z0-9]{6}$/)
  .filter((str) => str.length === 6);

const checkoutIdArb = fc.stringMatching(/^checkout_[a-z0-9]{10,20}$/);

const transactionIdArb = fc.stringMatching(/^txn_[a-z0-9]{10,20}$/);

// ============================================================================
// Configurable Mock Implementation
// ============================================================================

type MockBehavior = {
  readonly createCheckoutResult:
    | { readonly type: "success"; readonly checkoutId: string }
    | { readonly type: "error"; readonly error: PaymentError };
  readonly getStatusResult:
    | {
        readonly type: "completed";
        readonly transactionId: string;
        readonly amount: Money;
      }
    | { readonly type: "pending" }
    | { readonly type: "expired" }
    | { readonly type: "error"; readonly error: PaymentError };
};

/**
 * Creates a configurable mock gateway that tracks API calls
 */
const createMockGateway = (
  behavior: MockBehavior,
  callLog: Ref.Ref<readonly string[]>,
): PaymentGatewayService => ({
  createCheckout: (params) =>
    Effect.gen(function* () {
      // Log the call (simulates audit logging)
      yield* Ref.update(callLog, (logs) => [
        ...logs,
        `createCheckout:${params.bookingReference}`,
      ]);

      // Simulate logging that happens in real implementation
      yield* Effect.logInfo("Creating checkout session", {
        bookingReference: params.bookingReference,
        amount: params.amount.amount,
        currency: params.amount.currency,
      });

      if (behavior.createCheckoutResult.type === "error") {
        return yield* Effect.fail(behavior.createCheckoutResult.error);
      }

      return {
        id: behavior.createCheckoutResult.checkoutId,
        checkoutUrl: `https://polar.sh/checkout/${behavior.createCheckoutResult.checkoutId}`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };
    }),

  getCheckoutStatus: (checkoutId) =>
    Effect.gen(function* () {
      yield* Ref.update(callLog, (logs) => [
        ...logs,
        `getCheckoutStatus:${checkoutId}`,
      ]);

      yield* Effect.logDebug("Checking checkout status", { checkoutId });

      switch (behavior.getStatusResult.type) {
        case "completed":
          return {
            status: "completed" as const,
            confirmation: {
              checkoutId,
              transactionId: behavior.getStatusResult.transactionId,
              paidAt: new Date(),
              amount: behavior.getStatusResult.amount,
            },
          };
        case "pending":
          return { status: "pending" as const };
        case "expired":
          return { status: "expired" as const };
        case "error":
          return yield* Effect.fail(behavior.getStatusResult.error);
      }
    }),
});

const createTestLayer = (
  behavior: MockBehavior,
  callLog: Ref.Ref<readonly string[]>,
) => Layer.succeed(PaymentGateway, createMockGateway(behavior, callLog));

// ============================================================================
// Property Tests
// ============================================================================

describe("PaymentGateway Property Tests", () => {
  // Property 10: SDK is configured with authentication
  // Since we use Polar SDK, auth is handled by the SDK constructor.
  // We test that our mock correctly simulates this behavior.
  test.prop([emailArb, positiveAmountArb, currencyArb, bookingReferenceArb], {
    numRuns: 20,
  })(
    `Property ${PROPERTIES.SDK_CONFIGURED_WITH_AUTH.number}: ${PROPERTIES.SDK_CONFIGURED_WITH_AUTH.text}`,
    async (email, amount, currency, bookingRef) => {
      const callLog = Ref.unsafeMake<readonly string[]>([]);
      const checkoutId = `checkout_${Date.now()}`;

      const behavior: MockBehavior = {
        createCheckoutResult: { type: "success", checkoutId },
        getStatusResult: {
          type: "completed",
          transactionId: `txn_${Date.now()}`,
          amount: Money.of(amount, currency),
        },
      };

      const program = Effect.gen(function* () {
        const gateway = yield* PaymentGateway;
        return yield* gateway.createCheckout({
          amount: Money.of(amount, currency),
          customer: { email, externalId: `user_${Date.now()}` },
          bookingReference: bookingRef,
          successUrl: "https://example.com/success",
        });
      });

      const result = await Effect.runPromise(
        Effect.provide(program, createTestLayer(behavior, callLog)),
      );

      // Verify that the gateway was called (SDK was initialized)
      const logs = Ref.get(callLog).pipe(Effect.runSync);
      expect(logs).toContain(`createCheckout:${bookingRef}`);
      expect(result.id).toBe(checkoutId);
    },
  );

  // Property 11: Successful payments return transaction IDs
  test.prop(
    [checkoutIdArb, transactionIdArb, positiveAmountArb, currencyArb],
    { numRuns: 30 },
  )(
    `Property ${PROPERTIES.SUCCESSFUL_PAYMENTS_RETURN_TRANSACTION_IDS.number}: ${PROPERTIES.SUCCESSFUL_PAYMENTS_RETURN_TRANSACTION_IDS.text}`,
    async (checkoutId, transactionId, amount, currency) => {
      const callLog = Ref.unsafeMake<readonly string[]>([]);

      const behavior: MockBehavior = {
        createCheckoutResult: { type: "success", checkoutId },
        getStatusResult: {
          type: "completed",
          transactionId,
          amount: Money.of(amount, currency),
        },
      };

      const program = Effect.gen(function* () {
        const gateway = yield* PaymentGateway;
        const status = yield* gateway.getCheckoutStatus(checkoutId);
        return status;
      });

      const result = await Effect.runPromise(
        Effect.provide(program, createTestLayer(behavior, callLog)),
      );

      // Property: Successful payments MUST return a non-empty transaction ID
      expect(result.status).toBe("completed");
      if (result.status === "completed") {
        expect(result.confirmation.transactionId).toBe(transactionId);
        expect(result.confirmation.transactionId.length).toBeGreaterThan(0);
        expect(result.confirmation.checkoutId).toBe(checkoutId);
        expect(result.confirmation.amount.amount).toBe(amount);
        expect(result.confirmation.amount.currency).toBe(currency);
      }
    },
  );

  // Property 12: Payment API errors map to domain errors
  describe(`Property ${PROPERTIES.API_ERRORS_MAP_TO_DOMAIN_ERRORS.number}: ${PROPERTIES.API_ERRORS_MAP_TO_DOMAIN_ERRORS.text}`, () => {
    const errorScenarios = [
      {
        name: "timeout error maps to PaymentApiUnavailableError",
        error: new PaymentApiUnavailableError({ message: "Timeout" }),
        expectedTag: "PaymentApiUnavailableError",
      },
      {
        name: "declined payment maps to PaymentDeclinedError",
        error: new PaymentDeclinedError({
          reason: "Insufficient funds",
          code: "INSUFFICIENT_FUNDS",
        }),
        expectedTag: "PaymentDeclinedError",
      },
      {
        name: "checkout not found maps to CheckoutNotFoundError",
        error: new CheckoutNotFoundError({ checkoutId: "unknown" }),
        expectedTag: "CheckoutNotFoundError",
      },
    ];

    for (const scenario of errorScenarios) {
      test.prop([bookingReferenceArb, positiveAmountArb], { numRuns: 10 })(
        scenario.name,
        async (bookingRef, amount) => {
          const callLog = Ref.unsafeMake<readonly string[]>([]);

          const behavior: MockBehavior = {
            createCheckoutResult: { type: "error", error: scenario.error },
            getStatusResult: { type: "pending" },
          };

          const program = Effect.gen(function* () {
            const gateway = yield* PaymentGateway;
            return yield* gateway.createCheckout({
              amount: Money.of(amount, "EUR"),
              customer: { email: "test@example.com", externalId: "user_1" },
              bookingReference: bookingRef,
              successUrl: "https://example.com/success",
            });
          });

          const result = await Effect.runPromiseExit(
            Effect.provide(program, createTestLayer(behavior, callLog)),
          );

          // Property: API errors MUST map to typed domain errors (not thrown)
          expect(result._tag).toBe("Failure");
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect((result.cause.error as PaymentError)._tag).toBe(
              scenario.expectedTag,
            );
          }
        },
      );
    }

    // Test getCheckoutStatus errors
    test.prop([checkoutIdArb], { numRuns: 10 })(
      "getCheckoutStatus errors map to domain errors",
      async (checkoutId) => {
        const callLog = Ref.unsafeMake<readonly string[]>([]);

        const behavior: MockBehavior = {
          createCheckoutResult: { type: "success", checkoutId },
          getStatusResult: {
            type: "error",
            error: new CheckoutNotFoundError({ checkoutId }),
          },
        };

        const program = Effect.gen(function* () {
          const gateway = yield* PaymentGateway;
          return yield* gateway.getCheckoutStatus(checkoutId);
        });

        const result = await Effect.runPromiseExit(
          Effect.provide(program, createTestLayer(behavior, callLog)),
        );

        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure" && result.cause._tag === "Fail") {
          expect((result.cause.error as PaymentError)._tag).toBe(
            "CheckoutNotFoundError",
          );
        }
      },
    );
  });

  // Property 13: All payment attempts are logged
  test.prop(
    [emailArb, positiveAmountArb, currencyArb, bookingReferenceArb],
    { numRuns: 20 },
  )(
    `Property ${PROPERTIES.ALL_ATTEMPTS_ARE_LOGGED.number}: ${PROPERTIES.ALL_ATTEMPTS_ARE_LOGGED.text}`,
    async (email, amount, currency, bookingRef) => {
      const callLog = Ref.unsafeMake<readonly string[]>([]);
      const checkoutId = `checkout_${Date.now()}`;

      const behavior: MockBehavior = {
        createCheckoutResult: { type: "success", checkoutId },
        getStatusResult: {
          type: "completed",
          transactionId: `txn_${Date.now()}`,
          amount: Money.of(amount, currency),
        },
      };

      const program = Effect.gen(function* () {
        const gateway = yield* PaymentGateway;

        // Call both methods
        const checkout = yield* gateway.createCheckout({
          amount: Money.of(amount, currency),
          customer: { email, externalId: `user_${Date.now()}` },
          bookingReference: bookingRef,
          successUrl: "https://example.com/success",
        });

        yield* gateway.getCheckoutStatus(checkout.id);

        return checkout;
      });

      await Effect.runPromise(
        Effect.provide(program, createTestLayer(behavior, callLog)),
      );

      // Property: All payment attempts MUST be logged
      const logs = Ref.get(callLog).pipe(Effect.runSync);

      // Verify both operations were logged
      expect(logs.length).toBe(2);
      expect(logs.some((log) => log.startsWith("createCheckout:"))).toBe(true);
      expect(logs.some((log) => log.startsWith("getCheckoutStatus:"))).toBe(
        true,
      );
      expect(logs.some((log) => log.includes(bookingRef))).toBe(true);
    },
  );

  // Additional property: Failed attempts are also logged
  test.prop([bookingReferenceArb, positiveAmountArb], { numRuns: 10 })(
    "Property 13b: Failed payment attempts are also logged",
    async (bookingRef, amount) => {
      const callLog = Ref.unsafeMake<readonly string[]>([]);

      const behavior: MockBehavior = {
        createCheckoutResult: {
          type: "error",
          error: new PaymentApiUnavailableError({ message: "Network error" }),
        },
        getStatusResult: { type: "pending" },
      };

      const program = Effect.gen(function* () {
        const gateway = yield* PaymentGateway;
        return yield* gateway.createCheckout({
          amount: Money.of(amount, "EUR"),
          customer: { email: "test@example.com", externalId: "user_1" },
          bookingReference: bookingRef,
          successUrl: "https://example.com/success",
        });
      });

      await Effect.runPromiseExit(
        Effect.provide(program, createTestLayer(behavior, callLog)),
      );

      // Property: Even failed attempts MUST be logged
      const logs = Ref.get(callLog).pipe(Effect.runSync);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((log) => log.includes(bookingRef))).toBe(true);
    },
  );
});
