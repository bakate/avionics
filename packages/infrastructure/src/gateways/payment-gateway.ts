/**
 * @file payment-gateway.ts
 * @module @workspace/infrastructure/gateways
 * @description Payment Gateway implementation using Polar API
 *
 * Features:
 * - Checkout session creation via Polar SDK
 * - Status polling for checkout completion
 * - Retry policy with exponential backoff
 * - Audit logging for all payment attempts
 *
 * Two layers provided:
 * - PaymentGatewayLive: Real Polar API integration
 * - PaymentGatewayTest: Mock for testing (instant completion)
 */

import { Polar } from "@polar-sh/sdk";
import {
  CheckoutNotFoundError,
  type CheckoutSession,
  type CheckoutStatus,
  PaymentApiUnavailableError,
  PaymentDeclinedError,
  type PaymentError,
  PaymentGateway,
  type PaymentGatewayService,
} from "@workspace/application/payment.gateway";
import { Money } from "@workspace/domain/kernel";
import { Duration, Effect, Layer, Redacted, Schedule } from "effect";
import { PolarConfig } from "../config/infrastructure-config.js";

// ============================================================================
// Polar SDK Error Mapping
// ============================================================================

const mapPolarError = (error: unknown): PaymentError => {
  // Handle Polar SDK specific errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("timeout") || message.includes("network")) {
      return new PaymentApiUnavailableError({
        message: `Polar API unavailable: ${error.message}`,
        cause: error,
      });
    }

    if (message.includes("declined") || message.includes("insufficient")) {
      return new PaymentDeclinedError({
        reason: error.message,
        code: "PAYMENT_DECLINED",
      });
    }

    if (message.includes("not found") || message.includes("expired")) {
      return new CheckoutNotFoundError({
        checkoutId: "unknown",
      });
    }
  }

  return new PaymentApiUnavailableError({
    message: `Polar API error: ${String(error)}`,
    cause: error,
  });
};

// ============================================================================
// Live Implementation - Polar API
// ============================================================================

/**
 * Production Payment Gateway using Polar API
 *
 * Requires:
 * - POLAR_API_KEY environment variable
 * - POLAR_PRODUCT_ID environment variable (the product for flight bookings)
 */
export const PaymentGatewayLive = Layer.effect(
  PaymentGateway,
  Effect.gen(function* () {
    const config = yield* PolarConfig;

    // Initialize Polar SDK
    const polar = new Polar({
      accessToken: Redacted.value(config.apiKey),
      server: config.baseUrl.includes("sandbox") ? "sandbox" : "production",
    });

    // Retry policy: 2 attempts with exponential backoff
    const retryPolicy = Schedule.exponential(Duration.millis(500)).pipe(
      Schedule.intersect(Schedule.recurs(config.maxRetries)),
    );

    // ========================================================================
    // createCheckout
    // ========================================================================
    const createCheckout: PaymentGatewayService["createCheckout"] = (params) =>
      Effect.gen(function* () {
        yield* Effect.logInfo("Creating Polar checkout session", {
          bookingReference: params.bookingReference,
          amount: params.amount.amount,
          currency: params.amount.currency,
        });

        // Validate currency support
        const currency = params.amount.currency.toLowerCase();
        if (currency !== "eur" && currency !== "usd" && currency !== "gbp") {
          return yield* Effect.fail(
            new PaymentDeclinedError({
              reason: `Unsupported currency: ${params.amount.currency}. Supported: EUR, USD, GBP`,
              code: "UNSUPPORTED_CURRENCY",
            }),
          );
        }

        const amountCents = params.amount.toCents();

        // Create checkout session with dynamic pricing
        const response = yield* Effect.tryPromise({
          try: () =>
            polar.checkouts.create(
              {
                products: [config.productId],
                amount: amountCents, // Polar uses cents
                currency: currency as "eur" | "usd" | "gbp",
                customerEmail: params.customer.email,
                externalCustomerId: params.customer.externalId,
                successUrl: params.successUrl,
                returnUrl: params.cancelUrl,
                metadata: {
                  bookingReference: params.bookingReference,
                },
              },
              {
                headers: {
                  "Idempotency-Key": `checkout_${params.bookingReference}`,
                },
              },
            ),
          catch: mapPolarError,
        }).pipe(Effect.retry(retryPolicy));

        yield* Effect.logInfo("Polar checkout session created", {
          checkoutId: response.id,
          bookingReference: params.bookingReference,
        });

        return {
          id: response.id,
          checkoutUrl: response.url,
          expiresAt: response.expiresAt,
        } satisfies CheckoutSession;
      }).pipe(
        Effect.timeout(Duration.seconds(config.timeout)),
        Effect.catchTag("TimeoutException", () =>
          Effect.fail(
            new PaymentApiUnavailableError({
              message: `Polar API timeout after ${config.timeout} seconds`,
            }),
          ),
        ),
      );

    // ========================================================================
    // getCheckoutStatus
    // ========================================================================
    const getCheckoutStatus: PaymentGatewayService["getCheckoutStatus"] = (
      checkoutId,
    ) =>
      Effect.gen(function* () {
        yield* Effect.logDebug("Polling Polar checkout status", { checkoutId });

        const response = yield* Effect.tryPromise({
          try: () => polar.checkouts.get({ id: checkoutId }),
          catch: (error) => {
            const mapped = mapPolarError(error);
            if (mapped._tag === "CheckoutNotFoundError") {
              return new CheckoutNotFoundError({ checkoutId });
            }
            return mapped;
          },
        });

        // Map Polar status to our domain
        // Polar statuses: open, expired, confirmed, succeeded, failed
        switch (response.status) {
          case "succeeded": {
            // Access potential timestamp fields that might be missing from strict SDK types
            const detailedResponse = response as {
              succeededAt?: string | number | Date | null;
              completedAt?: string | number | Date | null;
              paidAt?: string | number | Date | null;
            };
            const explicitDate =
              detailedResponse.succeededAt ||
              detailedResponse.completedAt ||
              detailedResponse.paidAt;

            let paidAt: Date;
            if (explicitDate) {
              paidAt = new Date(explicitDate);
            } else if (response.modifiedAt) {
              paidAt = response.modifiedAt;
            } else {
              paidAt = new Date();
              yield* Effect.logWarning(
                "Using current time for payment timestamp (missing upstream timestamp)",
                { checkoutId: response.id },
              );
            }

            return {
              status: "completed",
              confirmation: {
                checkoutId: response.id,
                transactionId: response.id, // Polar uses checkout ID as transaction ID
                paidAt,
                amount: Money.of(
                  response.totalAmount / 100,
                  response.currency.toUpperCase() as "EUR" | "USD" | "GBP",
                ),
              },
            } satisfies CheckoutStatus;
          }

          case "expired":
          case "failed":
            return { status: "expired" } satisfies CheckoutStatus;

          default:
            // open, confirmed (payment in progress)
            return { status: "pending" } satisfies CheckoutStatus;
        }
      }).pipe(
        Effect.timeout(Duration.seconds(10)),
        Effect.catchTag("TimeoutException", () =>
          Effect.fail(
            new PaymentApiUnavailableError({
              message: "Polar API timeout while checking status",
            }),
          ),
        ),
      );

    return {
      createCheckout,
      getCheckoutStatus,
    } satisfies PaymentGatewayService;
  }),
);

// ============================================================================
// Test Implementation - Instant Mock
// ============================================================================

/**
 * Test Payment Gateway that instantly completes checkouts
 * Useful for unit tests and development without real Polar API
 */
export const PaymentGatewayTest = Layer.succeed(PaymentGateway, {
  createCheckout: (params) =>
    Effect.gen(function* () {
      const checkoutId = `checkout_test_${Date.now()}`;

      yield* Effect.logDebug("Test checkout created", {
        checkoutId,
        bookingReference: params.bookingReference,
      });

      return {
        id: checkoutId,
        checkoutUrl: `https://test.polar.sh/checkout/${checkoutId}`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      } satisfies CheckoutSession;
    }),

  getCheckoutStatus: (checkoutId) =>
    Effect.gen(function* () {
      yield* Effect.logDebug("Test checkout status check", { checkoutId });

      // Instantly return completed for tests
      return {
        status: "completed",
        confirmation: {
          checkoutId,
          transactionId: `txn_test_${Date.now()}`,
          paidAt: new Date(),
          amount: Money.of(100, "EUR"), // Default test amount
        },
      } satisfies CheckoutStatus;
    }),
} satisfies PaymentGatewayService);
