import { SqlClient } from "@effect/sql";
import {
  TicketRepository,
  type TicketRepositoryPort,
} from "@workspace/application/ticket.repository";
import { type Ticket } from "@workspace/domain/ticket";
import { Effect, Layer } from "effect";
import {
  type CouponRow,
  fromTicketRow,
  type TicketRow,
  toCouponRows,
  toTicketRow,
} from "./mappers/ticket.mapper.js";

export const PostgresTicketRepositoryLive = Layer.effect(
  TicketRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const save: TicketRepositoryPort["save"] = (ticket: Ticket) =>
      sql.withTransaction(
        Effect.gen(function* () {
          const ticketRow = toTicketRow(ticket);
          const couponRows = toCouponRows(ticket);

          // Upsert Ticket
          yield* sql`
            INSERT INTO tickets ${sql.insert(ticketRow)}
            ON CONFLICT (ticket_number) DO UPDATE SET
              status = ${ticketRow.status},
              passenger_id = ${ticketRow.passenger_id},
              passenger_name = ${ticketRow.passenger_name},
              issued_at = ${ticketRow.issued_at}
          `;

          // Replace Coupons
          yield* sql`DELETE FROM coupons WHERE ticket_number = ${ticket.ticketNumber}`;

          if (couponRows.length > 0) {
            yield* sql`INSERT INTO coupons ${sql.insert(couponRows)}`;
          }

          return ticket;
        }),
      );

    const findByTicketNumber: TicketRepositoryPort["findByTicketNumber"] = (
      ticketNumber: string,
    ) =>
      Effect.gen(function* () {
        const ticketRows = yield* sql<TicketRow>`
          SELECT * FROM tickets WHERE ticket_number = ${ticketNumber}
        `;

        const ticketRow = ticketRows[0];
        if (!ticketRow) {
          return null;
        }

        const couponRows = yield* sql<CouponRow>`
          SELECT * FROM coupons WHERE ticket_number = ${ticketNumber} ORDER BY coupon_number ASC
        `;

        return fromTicketRow(ticketRow, couponRows);
      });

    return {
      save,
      findByTicketNumber,
    };
  }),
);
