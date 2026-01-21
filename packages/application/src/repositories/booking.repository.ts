import type { Booking } from "@workspace/domain/booking";
import type { BookingNotFoundError } from "@workspace/domain/errors";
import { Context, type Effect } from "effect";

export interface BookingRepositoryPort {
  save(booking: Booking): Effect.Effect<void>;
  findById(id: string): Effect.Effect<Booking, BookingNotFoundError>;
  findByPnr(pnr: string): Effect.Effect<Booking, BookingNotFoundError>;
}
export class BookingRepository extends Context.Tag("BookingRepository")<
  BookingRepository,
  BookingRepositoryPort
>() {}
