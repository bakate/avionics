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
 * - Sandbox mode detection (forces USD currency)
 *
 * Two layers provided:
 * - PaymentGatewayLive: Real Polar API integration
 * - PaymentGatewayTest: Mock for testing (instant completion)
 */

import { Polar } from "@polar-sh/sdk";
import { type Checkout } from "@polar-sh/sdk/models/components/checkout.js";
import { type PresentmentCurrency } from "@polar-sh/sdk/models/components/presentmentcurrency.js";

// Extended checkout type with potentially missing SDK fields
interface PolarCheckoutWithExtras extends Checkout {
  succeededAt?: string;
  failureReason?: string;
  paymentId?: string;
  transactionId?: string;
}

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
import { PolarConfig } from "@workspace/config";
import { type CurrencyCode, Money } from "@workspace/domain/kernel";
import { Duration, Effect, Layer, Redacted, Schedule } from "effect";
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
// ============================================================================
// Layer Implementations
// ============================================================================

/**
 * NOTE: We avoid using a class with static members (e.g., PolarPaymentGateway.Live)
 * to satisfy linting rules (Avoid classes that contain only static members)
 * and to follow the functional paradigm of the Effect library.
 */

/**
 * Production Payment Gateway Layer using Polar API
 */
export const PolarPaymentGatewayLive = Layer.effect(
  PaymentGateway,
  Effect.gen(function* () {
    const config = yield* PolarConfig;
    const auditLogger = yield* AuditLogger;

    // Initialize Polar SDK
    const polar = new Polar({
      accessToken: Redacted.value(config.apiKey),
      serverURL: config.baseUrl,
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
          bookingId: params.bookingId,
          amount: params.amount.amount,
          currency: params.amount.currency,
          isSandbox: config.isSandbox,
        });

        // Audit log the attempt
        yield* auditLogger.log({
          aggregateType: "Booking",
          aggregateId: params.bookingId,
          operation: "UPDATE",
          changes: {
            paymentAttempt: true,
            pnr: params.bookingReference,
            amount: params.amount.amount,
            currency: params.amount.currency,
          },
        });

        const currency = params.amount.currency.toLowerCase();

        // Sandbox only supports USD
        const checkoutCurrency = config.isSandbox ? "usd" : currency;
        const supported = ["eur", "usd", "gbp", "chf"];

        if (!supported.includes(currency)) {
          return yield* Effect.fail(
            new UnsupportedCurrencyError({
              currency: params.amount.currency,
              supported: ["EUR", "USD", "GBP", "CHF"],
            }),
          );
        }

        // Warn if sandbox forces currency conversion
        if (config.isSandbox && currency !== "usd") {
          yield* Effect.logWarning(
            "Sandbox mode: forcing USD currency (requested currency not supported in sandbox)",
            {
              requestedCurrency: params.amount.currency,
              forcedCurrency: "USD",
              bookingReference: params.bookingReference,
            },
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
                amount: amountCents,
                currency: checkoutCurrency as PresentmentCurrency, // 'usd' in sandbox, actual currency in prod
                customerEmail: params.customer.email,
                externalCustomerId: params.customer.externalId,
                successUrl: params.successUrl,
                metadata: {
                  bookingId: params.bookingId,
                  bookingReference: params.bookingReference,
                  requestedCurrency: params.amount.currency, // Original currency
                  actualCurrency: checkoutCurrency.toUpperCase(), // Currency used for payment
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
          currency: checkoutCurrency,
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

    const getCheckoutStatus: PaymentGatewayService["getCheckoutStatus"] = (
      checkoutId,
    ) =>
      Effect.gen(function* () {
        const response = (yield* Effect.tryPromise({
          try: () => polar.checkouts.get({ id: checkoutId }),
          catch: mapPolarError,
        }).pipe(
          Effect.retry({
            schedule: retryPolicy,
            while: (error) => error._tag === "PaymentApiUnavailableError",
          }),
        )) as PolarCheckoutWithExtras;

        if (response.status === "succeeded") {
          // Use actual transaction ID if available, otherwise synthetic placeholder
          const transactionId =
            response.transactionId ??
            response.paymentId ??
            `txn_${response.id}`; // Placeholder for reconciliation/dispute workflows

          return {
            status: "completed",
            confirmation: {
              checkoutId: response.id,
              transactionId,
              paidAt: response.succeededAt
                ? new Date(response.succeededAt)
                : new Date(),
              amount: Money.of(
                (response.totalAmount ?? 0) / 100,
                (response.currency ?? "EUR").toUpperCase() as CurrencyCode,
              ),
            },
          } satisfies CheckoutStatus;
        }

        if (response.status === "failed") {
          return {
            status: "failed",
            reason: response.failureReason ?? "Payment declined or failed",
          } satisfies CheckoutStatus;
        }

        if (response.status === "expired") {
          return { status: "expired" } satisfies CheckoutStatus;
        }

        return { status: "pending" } satisfies CheckoutStatus;
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

    return {
      createCheckout,
      getCheckoutStatus,
    } satisfies PaymentGatewayService;
  }),
);

/**
 * Polar Payment Gateway Test Layer (Mock realization)
 */
export const PolarPaymentGatewayTest = (
  overrides: Partial<PaymentGatewayService> = {},
) =>
  Layer.succeed(
    PaymentGateway,
    PaymentGateway.of({
      createCheckout: (params) =>
        Effect.gen(function* () {
          const checkoutId = `checkout_test_${Date.now()}`;

          yield* Effect.logDebug("Test checkout created", {
            checkoutId,
            bookingReference: params.bookingReference,
            bookingId: params.bookingId,
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
