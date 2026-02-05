import { type Ticket } from "@workspace/domain/ticket";
import { Context, type Effect } from "effect";

export class NotificationGateway extends Context.Tag("NotificationGateway")<
  NotificationGateway,
  {
    readonly sendTicket: (ticket: Ticket, email: string) => Effect.Effect<void>;
  }
>() {}
