// Basic Mock Gateway for Notification
// Real implementation would use SendGrid/AWS SES
import { NotificationGateway } from "@workspace/application/notification.gateway";
import { Effect, Layer } from "effect";

export const NotificationGatewayLive = Layer.succeed(
  NotificationGateway,
  NotificationGateway.of({
    sendTicket: (ticket, email) =>
      Effect.logInfo(
        `[Notification] Sending Ticket ${ticket.ticketNumber} to ${email}`,
      ),
  }),
);
