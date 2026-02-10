import {
  type EmailRecipient,
  InvalidRecipientError,
  NotificationApiUnavailableError,
  NotificationAuthenticationError,
  NotificationGateway,
  type NotificationGatewayService,
  NotificationRateLimitError,
  type NotificationResult,
} from "@workspace/application/notification.gateway";
import { type Ticket } from "@workspace/domain/ticket";
import { Effect, Layer, Option, Redacted, Schedule } from "effect";
import { Resend } from "resend";
import { ResendConfig } from "../config/infrastructure-config.js";
import { AuditLogger } from "../services/audit-logger.js";

const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const createTicketEmailHtml = (
  ticket: Ticket,
  recipientName: string,
): string => {
  const ticketNumber = escapeHtml(ticket.ticketNumber);
  const pnrCode = escapeHtml(ticket.pnrCode);
  const issuedAt = ticket.issuedAt.toISOString().split("T")[0];

  const flightDetails = ticket.coupons
    .map(
      (coupon) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(coupon.flightId)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(Option.getOrElse(coupon.seatNumber, () => "TBA"))}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(coupon.status)}</td>
      </tr>
    `,
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E-Ticket Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0; padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">✈️ Avionics</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Your E-Ticket Confirmation</p>
    </div>

    <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
        Dear <strong>${escapeHtml(recipientName)}</strong>,
      </p>
      <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
        Thank you for booking with Avionics. Your e-ticket has been issued successfully.
      </p>

      <div style="background: #f7fafc; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h2 style="color: #2d3748; margin: 0 0 15px; font-size: 18px;">Ticket Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #718096;">Ticket Number:</td>
            <td style="padding: 8px 0; color: #2d3748; font-weight: bold; font-family: monospace;">${ticketNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #718096;">Booking Reference (PNR):</td>
            <td style="padding: 8px 0; color: #2d3748; font-weight: bold; font-family: monospace;">${pnrCode}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #718096;">Issue Date:</td>
            <td style="padding: 8px 0; color: #2d3748;">${issuedAt}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #718096;">Status:</td>
            <td style="padding: 8px 0;">
              <span style="background: #48bb78; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px;">
                ${escapeHtml(ticket.status)}
              </span>
            </td>
          </tr>
        </table>
      </div>

      <h2 style="color: #2d3748; margin: 25px 0 15px; font-size: 18px;">Flight Details</h2>
      <table style="width: 100%; border-collapse: collapse; background: #f7fafc; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #edf2f7;">
            <th style="padding: 12px; text-align: left; color: #4a5568;">Flight</th>
            <th style="padding: 12px; text-align: left; color: #4a5568;">Seat</th>
            <th style="padding: 12px; text-align: left; color: #4a5568;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${flightDetails}
        </tbody>
      </table>

      <div style="background: #ebf8ff; border-left: 4px solid #4299e1; padding: 15px; margin: 25px 0; border-radius: 0 8px 8px 0;">
        <p style="color: #2b6cb0; margin: 0; font-size: 14px;">
          <strong>Important:</strong> Please arrive at the airport at least 2 hours before departure for domestic flights
          and 3 hours for international flights.
        </p>
      </div>

      <p style="color: #718096; font-size: 14px; line-height: 1.6; margin-top: 30px;">
        If you have any questions, please contact our support team.
      </p>
      <p style="color: #4a5568; font-size: 16px; margin-top: 20px;">
        Safe travels!<br>
        <strong>The Avionics Team</strong>
      </p>
    </div>

    <div style="text-align: center; padding: 20px; color: #a0aec0; font-size: 12px;">
      <p>© 2026 Avionics. All rights reserved.</p>
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
};

const createTicketEmailText = (
  ticket: Ticket,
  recipientName: string,
): string => {
  const flightDetails = ticket.coupons
    .map(
      (coupon) =>
        `  - Flight: ${coupon.flightId}, Seat: ${Option.getOrElse(coupon.seatNumber, () => "TBA")}, Status: ${coupon.status}`,
    )
    .join("\n");

  return `
AVIONICS - E-TICKET CONFIRMATION
================================

Dear ${recipientName},

Thank you for booking with Avionics. Your e-ticket has been issued successfully.

TICKET DETAILS
--------------
Ticket Number: ${ticket.ticketNumber}
Booking Reference (PNR): ${ticket.pnrCode}
Issue Date: ${ticket.issuedAt.toISOString().split("T")[0]}
Status: ${ticket.status}

FLIGHT DETAILS
--------------
${flightDetails}

IMPORTANT
---------
Please arrive at the airport at least 2 hours before departure for domestic flights
and 3 hours for international flights.

Safe travels!
The Avionics Team

---
© 2026 Avionics. All rights reserved.
This is an automated message. Please do not reply to this email.
  `.trim();
};

interface ResendErrorResponse {
  readonly statusCode?: number;
  readonly message?: string;
  readonly name?: string;
  readonly headers?:
    | Record<string, string | undefined>
    | { get(name: string): string | null };
}

type NotificationError =
  | NotificationApiUnavailableError
  | NotificationAuthenticationError
  | InvalidRecipientError
  | NotificationRateLimitError;

const mapResendError = (error: unknown, email: string): NotificationError => {
  if (error instanceof Error) {
    const errorResponse = error as ResendErrorResponse;
    const statusCode = errorResponse.statusCode;
    const message = errorResponse.message ?? error.message;

    if (statusCode === 401) {
      return new NotificationAuthenticationError({
        message: "Invalid Resend API key",
      });
    }

    if (statusCode === 429) {
      let retryAfterSeconds = 60;
      const headers = errorResponse.headers;

      if (headers) {
        const retryAfter =
          typeof headers.get === "function"
            ? headers.get("retry-after")
            : ((headers as Record<string, string | undefined>)["retry-after"] ??
              (headers as Record<string, string | undefined>)["Retry-After"]);

        if (retryAfter) {
          const parsed = parseInt(retryAfter, 10);
          if (!Number.isNaN(parsed)) {
            retryAfterSeconds = parsed;
          } else {
            const date = Date.parse(retryAfter);
            if (!Number.isNaN(date)) {
              retryAfterSeconds = Math.max(
                0,
                Math.ceil((date - Date.now()) / 1000),
              );
            }
          }
        }
      }

      return new NotificationRateLimitError({ retryAfterSeconds });
    }

    if (
      statusCode === 422 ||
      (statusCode === 400 && message.toLowerCase().includes("email"))
    ) {
      return new InvalidRecipientError({ email, reason: message });
    }

    if (
      error.name === "TimeoutError" ||
      message.includes("ECONNREFUSED") ||
      message.includes("ETIMEDOUT") ||
      message.includes("fetch failed")
    ) {
      return new NotificationApiUnavailableError({
        message: "Network error: Unable to reach Resend API",
        cause: error,
      });
    }
  }

  return new NotificationApiUnavailableError({
    message: error instanceof Error ? error.message : "Unknown error",
    cause: error,
  });
};

const maskEmail = (email: string): string => {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const maskedLocal =
    local.length <= 2 ? local : `${local[0]}***${local.at(-1)}`;
  return `${maskedLocal}@${domain}`;
};

/**
 * Resend implementation of the NotificationGateway.
 */
export const ResendNotificationGatewayCreateLive = (config: ResendConfig) =>
  Layer.effect(
    NotificationGateway,
    Effect.gen(function* () {
      const auditLogger = yield* AuditLogger;
      const resend = new Resend(Redacted.value(config.apiKey));

      const retryPolicy = Schedule.exponential("500 millis").pipe(
        Schedule.intersect(Schedule.recurs(config.maxRetries)),
        Schedule.whileInput(
          (error: NotificationError) =>
            error._tag === "NotificationApiUnavailableError" ||
            error._tag === "NotificationRateLimitError",
        ),
      );

      const sendTicket: NotificationGatewayService["sendTicket"] = (
        ticket: Ticket,
        recipient: EmailRecipient,
      ) =>
        Effect.gen(function* () {
          yield* Effect.logInfo("Sending ticket confirmation email", {
            ticketNumber: ticket.ticketNumber,
            pnrCode: ticket.pnrCode,
            recipientEmail: maskEmail(recipient.email),
          });

          const recipientName = recipient.name ?? ticket.passengerName;

          const result = yield* Effect.tryPromise({
            try: () =>
              resend.emails.send({
                from: config.fromEmail,
                to: [recipient.email],
                subject: `Your E-Ticket Confirmation - ${ticket.pnrCode}`,
                html: createTicketEmailHtml(ticket, recipientName),
                text: createTicketEmailText(ticket, recipientName),
              }),
            catch: (error) => mapResendError(error, recipient.email),
          }).pipe(
            Effect.flatMap((response) => {
              if (response.error) {
                return Effect.fail(
                  mapResendError(response.error, recipient.email),
                );
              }
              return Effect.succeed(response);
            }),
            Effect.retry(retryPolicy),
          );

          if (!result.data?.id) {
            return yield* Effect.fail(
              new NotificationApiUnavailableError({
                message: "Resend API returned no message ID",
              }),
            );
          }

          yield* Effect.logInfo("Ticket confirmation email sent", {
            messageId: result.data.id,
            ticketNumber: ticket.ticketNumber,
          });

          // Audit log the notification
          yield* auditLogger.log({
            aggregateType: "Ticket",
            aggregateId: ticket.ticketNumber,
            operation: "UPDATE",
            changes: {
              notificationSent: "TicketConfirmation",
              recipientEmail: maskEmail(recipient.email),
            },
          });
          return { messageId: result.data.id } satisfies NotificationResult;
        });

      return { sendTicket };
    }),
  );

/**
 * Live Layer — Implementation using Resend API.
 */
export const ResendNotificationGatewayLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* ResendConfig;
    return ResendNotificationGatewayCreateLive(config);
  }),
);

/**
 * Test Layer — Mock implementation.
 */
export const ResendNotificationGatewayTest = (
  overrides: Partial<NotificationGatewayService> = {},
) =>
  Layer.succeed(
    NotificationGateway,
    NotificationGateway.of({
      sendTicket: (ticket, recipient) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(
            `[TEST] Sending Ticket ${ticket.ticketNumber} to ${recipient.email}`,
          );
          return {
            messageId: `test_msg_${Date.now()}`,
          } satisfies NotificationResult;
        }),
      ...overrides,
    }),
  );
