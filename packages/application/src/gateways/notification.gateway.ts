/**
 * @file notification.gateway.ts
 * @module @workspace/application/gateways
 * @description Port for notification operations (emails, SMS, etc.)
 *
 * This port abstracts the notification delivery mechanism, allowing
 * the application layer to send notifications without knowing the
 * underlying provider (Resend, SendGrid, AWS SES, etc.).
 */

import { type Ticket } from "@workspace/domain/ticket";
import { Context, Data, type Effect } from "effect";

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a successful notification send
 */
export interface NotificationResult {
  /** Unique message ID from the notification provider */
  readonly messageId: string;
}

/**
 * Email recipient details
 */
export interface EmailRecipient {
  readonly email: string;
  readonly name?: string;
}

// ============================================================================
// Errors
// ============================================================================

/**
 * API is unavailable (network error, timeout)
 */
export class NotificationApiUnavailableError extends Data.TaggedError(
  "NotificationApiUnavailableError",
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Invalid API key or authentication failure
 */
export class NotificationAuthenticationError extends Data.TaggedError(
  "NotificationAuthenticationError",
)<{
  readonly message: string;
}> {}

/**
 * Invalid recipient (bounce, invalid email format)
 */
export class InvalidRecipientError extends Data.TaggedError(
  "InvalidRecipientError",
)<{
  readonly email: string;
  readonly reason: string;
}> {}

/**
 * Rate limit exceeded
 */
export class NotificationRateLimitError extends Data.TaggedError(
  "NotificationRateLimitError",
)<{
  readonly retryAfterSeconds?: number;
}> {}

/**
 * Union of all notification errors
 */
export type NotificationError =
  | NotificationApiUnavailableError
  | NotificationAuthenticationError
  | InvalidRecipientError
  | NotificationRateLimitError;

// ============================================================================
// Service Interface
// ============================================================================

export interface NotificationGatewayService {
  /**
   * Send a ticket confirmation email
   *
   * @param ticket - The ticket to send
   * @param recipient - Recipient email address or object of type EmailRecipient
   * @returns Effect with message ID on success, NotificationError on failure
   */
  readonly sendTicket: (
    ticket: Ticket,
    recipient: EmailRecipient,
  ) => Effect.Effect<NotificationResult, NotificationError>;
}

export class NotificationGateway extends Context.Tag("NotificationGateway")<
  NotificationGateway,
  NotificationGatewayService
>() {}
