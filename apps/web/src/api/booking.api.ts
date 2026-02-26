import { type BookFlightCommand } from "@workspace/application/booking.commands";
import { BookingId, PnrCodeSchema } from "@workspace/domain/kernel";
import { Effect } from "effect";
import { makeClient } from "./client";

/**
 * Book a flight
 */
export const bookFlight = (command: BookFlightCommand) =>
  makeClient.pipe(
    Effect.flatMap((client) => client.bookings.book({ payload: command })),
  );

/**
 * Confirm a booking
 */
export const confirmBooking = (id: string) =>
  makeClient.pipe(
    Effect.flatMap((client) =>
      client.bookings.confirm({ path: { id: BookingId.make(id) } }),
    ),
  );

/**
 * Cancel a booking
 */
export const cancelBooking = (id: string, reason: string) =>
  makeClient.pipe(
    Effect.flatMap((client) =>
      client.bookings.cancel({
        path: { id: BookingId.make(id) },
        payload: { reason },
      }),
    ),
  );

export const getBookings = (email?: string) =>
  makeClient.pipe(
    Effect.flatMap((client) => client.bookings.list({ urlParams: { email } })),
  );

/**
 * Get booking summary by PNR
 */
export const getBookingByPnr = (pnr: string) =>
  makeClient.pipe(
    Effect.flatMap((client) =>
      client.bookings.getByPnr({
        path: { pnr: PnrCodeSchema.make(pnr) },
      }),
    ),
  );

/**
 * Get passenger booking history
 */
export const getPassengerHistory = (passengerId: string) =>
  makeClient.pipe(
    Effect.flatMap((client) =>
      client.bookings.getPassengerHistory({ path: { id: passengerId } }),
    ),
  );
