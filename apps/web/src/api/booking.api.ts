import { type BookFlightCommand } from "@workspace/application/booking.commands";
import { BookingId, PnrCodeSchema } from "@workspace/domain/kernel";
import { Effect, Request, RequestResolver } from "effect";
import { makeClient } from "@/api/client";

/**
 * Request identity for fetching a single booking by PNR
 */
export interface GetBookingByPnrRequest extends Request.Request<any, any> {
  readonly _tag: "GetBookingByPnrRequest";
  readonly pnr: string;
}

export const GetBookingByPnrRequest = Request.tagged<GetBookingByPnrRequest>(
  "GetBookingByPnrRequest",
);

/**
 * Resolver for PNR details calls (Booking API)
 */
const GetBookingByPnrResolver = RequestResolver.fromEffect(
  (req: GetBookingByPnrRequest) =>
    makeClient.pipe(
      Effect.flatMap((client) =>
        client.bookings.getByPnr({
          path: { pnr: PnrCodeSchema.make(req.pnr) },
        }),
      ),
    ),
);

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

/**
 * Fetch all bookings for a user
 */
export const getBookings = (email?: string) =>
  makeClient.pipe(
    Effect.flatMap((client) => client.bookings.list({ urlParams: { email } })),
  );

/**
 * Get booking summary by PNR (Cached & Deduplicated)
 */
export const getBookingByPnr = (pnr: string) =>
  Effect.request(GetBookingByPnrRequest({ pnr }), GetBookingByPnrResolver).pipe(
    Effect.withRequestCaching(true),
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
