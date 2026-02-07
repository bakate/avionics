import { type Ticket } from "@workspace/domain/ticket";
import { Context, type Effect } from "effect";

export class TicketRepository extends Context.Tag("TicketRepository")<
  TicketRepository,
  TicketRepositoryPort
>() {}

export interface TicketRepositoryPort {
  readonly save: (ticket: Ticket) => Effect.Effect<Ticket, unknown>;
  readonly findByTicketNumber: (
    ticketNumber: string,
  ) => Effect.Effect<Ticket | null, unknown>;
}
