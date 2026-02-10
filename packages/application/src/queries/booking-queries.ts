/**
 * @file booking-queries.ts
 * @module @workspace/application/queries
 * @description Query service for booking read models (CQRS read side)
 */

import {
  type BookingNotFoundError,
  type BookingPersistenceError,
} from "@workspace/domain/errors";
import { type PnrCode } from "@workspace/domain/kernel";
import { Context, type Effect } from "effect";
import {
  type BookingSummary,
  type PassengerBookingHistory,
} from "../models/read-models.js";

/**
 * Query service for booking read operations
 * Optimized for read performance, separate from command side
 */
export interface BookingQueriesPort {
  /**
   * Get booking summary by PNR (lightweight)
   */
  getSummaryByPnr(
    pnr: PnrCode,
  ): Effect.Effect<
    BookingSummary,
    BookingNotFoundError | BookingPersistenceError
  >;

  /**
   * List all bookings with pagination
   */
  listBookings(params: {
    page: number;
    pageSize: number;
    status?: string;
  }): Effect.Effect<
    {
      items: ReadonlyArray<BookingSummary>;
      total: number;
      page: number;
      pageSize: number;
    },
    BookingPersistenceError
  >;

  /**
   * Get passenger booking history
   */
  getPassengerHistory(
    passengerId: string,
  ): Effect.Effect<
    ReadonlyArray<PassengerBookingHistory>,
    BookingPersistenceError
  >;

  /**
   * Find expired bookings (for cleanup jobs)
   */
  findExpiredBookings(
    before: Date,
    limit: number,
  ): Effect.Effect<ReadonlyArray<BookingSummary>, BookingPersistenceError>;

  /**
   * Search bookings by passenger name
   */
  searchByPassengerName(
    name: string,
    limit: number,
  ): Effect.Effect<ReadonlyArray<BookingSummary>, BookingPersistenceError>;
}

export class BookingQueries extends Context.Tag("BookingQueries")<
  BookingQueries,
  BookingQueriesPort
>() {}
