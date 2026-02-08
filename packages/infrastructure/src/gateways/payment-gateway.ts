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
import { ExpiredCheckoutError } from "@polar-sh/sdk/models/errors/expiredcheckouterror.js";
import {
  ConnectionError,
  RequestTimeoutError,
} from "@polar-sh/sdk/models/errors/httpclienterrors.js";
import { PaymentError as PolarPaymentError } from "@polar-sh/sdk/models/errors/paymenterror.js";
import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound.js";
import {
  CheckoutNotFoundError,
  type CheckoutSession,
  type CheckoutStatus,
  PaymentApiUnavailableError,
  PaymentDeclinedError,
  type PaymentError,
  PaymentGateway,
  type PaymentGatewayService,
  UnsupportedCurrencyError,
} from "@workspace/application/payment.gateway";
import { type CurrencyCode, Money } from "@workspace/domain/kernel";
import { Duration, Effect, Layer, Redacted, Schedule } from "effect";
import { PolarConfig } from "../config/infrastructure-config.js";
import { AuditLogger } from "../services/audit-logger.js";

// ============================================================================
// Polar SDK Error Mapping
// ============================================================================

const mapPolarError = (error: unknown): PaymentError => {
  // Handle Polar SDK specific errors
  if (
    error instanceof RequestTimeoutError ||
    error instanceof ConnectionError
  ) {
    return new PaymentApiUnavailableError({
      message: `Polar API unavailable: ${error.message}`,
      cause: error,
    });
  }

  if (error instanceof PolarPaymentError) {
    return new PaymentDeclinedError({
      reason: error.message,
      code: "PAYMENT_DECLINED",
      cause: error,
    });
  }

  if (
    error instanceof ExpiredCheckoutError ||
    error instanceof ResourceNotFound
  ) {
    // Try to extract ID from error if available
    const errorObj = error as {
      checkoutId?: unknown;
      id?: unknown;
      resourceId?: unknown;
    };
    const checkoutId =
      errorObj.checkoutId || errorObj.id || errorObj.resourceId || "unknown";

    return new CheckoutNotFoundError({
      checkoutId: String(checkoutId),
      cause: error,
    });
  }

  return new PaymentApiUnavailableError({
    message: `Polar API error: ${error instanceof Error ? error.message : String(error)}`,
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
export class PolarPaymentGateway {
  /**
   * Live Layer — Implementation using Polar API.
   */
  static readonly Live = Layer.effect(
    PaymentGateway,
    Effect.gen(function* () {
      const config = yield* PolarConfig;
      const auditLogger = yield* AuditLogger;

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
      const createCheckout: PaymentGatewayService["createCheckout"] = (
        params,
      ) =>
        Effect.gen(function* () {
          yield* Effect.logInfo("Creating Polar checkout session", {
            bookingReference: params.bookingReference,
            amount: params.amount.amount,
            currency: params.amount.currency,
          });

          // Audit log the attempt
          yield* auditLogger
            .log({
              aggregateType: "Booking",
              aggregateId: params.bookingReference,
              operation: "UPDATE",
              changes: {
                paymentAttempt: true,
                amount: params.amount.amount,
                currency: params.amount.currency,
              },
            })
            .pipe(
              Effect.catchAll((err) =>
                Effect.logWarning("Audit log failed for payment attempt", {
                  error: err,
                }),
              ),
            );

          // Validate currency support (currency is set at product level in Polar)
          const currency = params.amount.currency.toLowerCase();
          const supported = ["eur", "usd", "gbp", "chf"];
          if (!supported.includes(currency)) {
            return yield* Effect.fail(
              new UnsupportedCurrencyError({
                currency: params.amount.currency,
                supported: ["EUR", "USD", "GBP", "CHF"],
              }),
            );
          }

          const amountCents = params.amount.toCents();

          // Create checkout session
          // Note: Currency is configured at the product level in Polar
          // We pass amount override for dynamic pricing
          const response = yield* Effect.tryPromise({
            try: () =>
              polar.checkouts.create(
                {
                  products: [config.productId],
                  amount: amountCents, // Polar uses cents, overrides product price
                  customerEmail: params.customer.email,
                  externalCustomerId: params.customer.externalId,
                  successUrl: params.successUrl,
                  metadata: {
                    bookingReference: params.bookingReference,
                    currency: params.amount.currency, // Store currency in metadata for reference
                  },
                },
                {
                  fetchOptions: {
                    headers: {
                      "Idempotency-Key": `checkout-${params.bookingReference}`,
                    },
                  },
                },
              ),
            catch: mapPolarError,
          }).pipe(
            Effect.retry({
              schedule: retryPolicy,
              while: (error) => error._tag === "PaymentApiUnavailableError",
            }),
          );

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
          yield* Effect.logDebug("Polling Polar checkout status", {
            checkoutId,
          });

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
              // Using 'in' check for safety
              const hasSucceededAt = "succeededAt" in response;
              const hasCompletedAt = "completedAt" in response;
              const hasPaidAt = "paidAt" in response;

              const explicitDate =
                (hasSucceededAt
                  ? (response as { succeededAt: string }).succeededAt
                  : null) ??
                (hasCompletedAt
                  ? (response as { completedAt: string }).completedAt
                  : null) ??
                (hasPaidAt ? (response as { paidAt: string }).paidAt : null);

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

              const totalCents = response.totalAmount;
              if (
                typeof totalCents !== "number" ||
                !Number.isFinite(totalCents)
              ) {
                return yield* Effect.fail(
                  new PaymentApiUnavailableError({
                    message: `Invalid totalAmount from Polar: ${totalCents}`,
                  }),
                );
              }

              return {
                status: "completed",
                confirmation: {
                  checkoutId: response.id,
                  transactionId: response.id, // Polar uses checkout ID as transaction ID
                  paidAt,
                  amount: Money.of(
                    totalCents / 100,
                    response.currency.toUpperCase() as CurrencyCode,
                  ),
                },
              } satisfies CheckoutStatus;
            }

            case "failed":
              return {
                status: "failed",
                reason:
                  "failureReason" in response
                    ? (response as { failureReason: string }).failureReason
                    : "unknown",
              } satisfies CheckoutStatus;

            case "expired":
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

  /**
   * Test Layer — Mock implementation.
   */
  static readonly Test = (overrides: Partial<PaymentGatewayService> = {}) =>
    Layer.succeed(
      PaymentGateway,
      PaymentGateway.of({
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
            yield* Effect.logDebug("Test checkout status check", {
              checkoutId,
            });

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
        ...overrides,
      }),
    );
}
