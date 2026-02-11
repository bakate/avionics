import { type Money } from "@workspace/domain/kernel";
import { Context, type Effect, Schema } from "effect";

// ============================================================================
// Checkout Session Types
// ============================================================================

/**
 * Checkout session created by the payment gateway
 * The client should be redirected to the checkoutUrl to complete payment
 */
export interface CheckoutSession {
  readonly id: string;
  readonly checkoutUrl: string;
  readonly expiresAt: Date;
}

/**
 * Customer information for checkout
 */
export interface CheckoutCustomer {
  readonly email: string;
  readonly externalId?: string; // Future: userId when auth is implemented
}

/**
 * Payment confirmation received via webhook or polling
 */
export interface PaymentConfirmation {
  readonly checkoutId: string;
  readonly transactionId: string;
  readonly paidAt: Date;
  readonly amount: Money;
}

/**
 * Checkout status
 */
export type CheckoutStatus =
  | { readonly status: "pending" }
  | { readonly status: "completed"; readonly confirmation: PaymentConfirmation }
  | { readonly status: "expired" }
  | { readonly status: "failed"; readonly reason: string };

// ============================================================================
// Payment Errors
// ============================================================================

/**
 * Error when payment API is unavailable
 */
export class PaymentApiUnavailableError extends Schema.TaggedError<PaymentApiUnavailableError>()(
  "PaymentApiUnavailableError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

/**
 * Error when payment is declined
 */
export class PaymentDeclinedError extends Schema.TaggedError<PaymentDeclinedError>()(
  "PaymentDeclinedError",
  {
    reason: Schema.String,
    code: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  },
) {}

/**
 * Error when checkout session is not found or expired
 */
export class CheckoutNotFoundError extends Schema.TaggedError<CheckoutNotFoundError>()(
  "CheckoutNotFoundError",
  {
    checkoutId: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

/**
 * Error when an unsupported currency is provided
 */
export class UnsupportedCurrencyError extends Schema.TaggedError<UnsupportedCurrencyError>()(
  "UnsupportedCurrencyError",
  {
    currency: Schema.String,
    supported: Schema.Array(Schema.String),
  },
) {}

/**
 * Union of all payment errors
 */
export type PaymentError =
  | PaymentApiUnavailableError
  | PaymentDeclinedError
  | CheckoutNotFoundError
  | UnsupportedCurrencyError;

// ============================================================================
// Payment Gateway Port
// ============================================================================

/**
 * Payment Gateway Service Interface
 *
 * Flow:
 * 1. createCheckout() - Creates a session, returns URL for customer redirect
 * 2. Customer pays on external checkout page (Polar)
 * 3. getCheckoutStatus() - Poll for completion (or use webhooks in prod)
 *
 * Implementations:
 * - PaymentGatewayLive: Real Polar API integration
 * - PaymentGatewayTest: Mock that instantly completes checkout
 */
export interface PaymentGatewayService {
  /**
   * Creates a checkout session for redirect-based payment
   *
   * @returns CheckoutSession with URL for customer redirect
   */
  readonly createCheckout: (params: {
    readonly amount: Money;
    readonly customer: CheckoutCustomer;
    readonly bookingReference: string; // The PNR/tracking code (e.g., "ABCDEF")
    readonly bookingId: string; // The internal database/order ID (UUID)
    readonly successUrl: string;
    readonly cancelUrl?: string;
  }) => Effect.Effect<CheckoutSession, PaymentError>;

  /**
   * Gets the current status of a checkout session
   *
   * In tests: immediately returns "completed"
   * In prod: polls Polar API or relies on webhooks
   */
  readonly getCheckoutStatus: (
    checkoutId: string,
  ) => Effect.Effect<CheckoutStatus, PaymentError>;
}

export class PaymentGateway extends Context.Tag("PaymentGateway")<
  PaymentGateway,
  PaymentGatewayService
>() {}
