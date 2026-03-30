import { HttpApiBuilder } from "@effect/platform";
import { BookingService } from "@workspace/application/booking.service";
import { BookingQueries } from "@workspace/application/booking-queries";
import * as Errors from "@workspace/domain/errors";
import { Effect } from "effect";
import { Api } from "../api.js";
import * as Utils from "../lib/api-utils.js";
import { BookingResponse, type PublicPassenger } from "./api.js";

// ============================================================================
// Helpers
// ============================================================================

const BOOKING_ALLOWED_TAGS = [
  "FlightFullError",
  "FlightNotFoundError",
  "OptimisticLockingError",
  "BookingExpiredError",
  "InvalidAmountError",
  "BookingNotFoundError",
  "BookingStatusError",
  "InventoryOvercapacityError",
  "InventoryPersistenceError",
  "RequestTimeoutError",
  "BookingPersistenceError",
  "PaymentApiUnavailableError",
  "PaymentDeclinedError",
  "CheckoutNotFoundError",
  "UnsupportedCurrencyError",
] as const;

const ensureBookingContract = (bookingId?: string) =>
  Utils.mapToContract(
    BOOKING_ALLOWED_TAGS,
    (e) =>
      new Errors.BookingPersistenceError({
        bookingId: bookingId ?? "N/A",
        reason: e instanceof Error ? e.message : String(e),
      }),
  );

// Helper: Map Booking to BookingResponse DTO
// We use 'any' here to simplify mapping from different read models and domain entities
// while keeping the runtime construction via Schema.Class safe.
const toBookingResponse = (booking: any): BookingResponse =>
  new BookingResponse({
    id: booking.id,
    pnrCode: booking.pnrCode,
    status: booking.status,
    passengers: booking.passengers.map((p: PublicPassenger) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      gender: p.gender,
      type: p.type,
    })),
    segments: booking.segments,
    expiresAt: booking.expiresAt,
    createdAt: booking.createdAt,
  });

// ============================================================================
// API Handlers
// ============================================================================

export const BookingApiLive = HttpApiBuilder.group(
  Api,
  "bookings",
  (handlers) =>
    handlers
      .handle("list", ({ urlParams }) =>
        Effect.gen(function* () {
          const queries = yield* BookingQueries;

          // Prevent global PII leak: only list if email is provided
          if (!urlParams.email) {
            return [];
          }

          return yield* queries.findByEmail(urlParams.email);
        }).pipe(ensureBookingContract()),
      )
      .handle("book", ({ payload }) =>
        Effect.gen(function* () {
          const service = yield* BookingService;
          const res = yield* service.bookFlight(payload);
          return {
            booking: toBookingResponse(res.booking),
            checkoutUrl: res.checkout?.checkoutUrl,
            checkoutId: res.checkout?.id,
          };
        }).pipe(
          Effect.catchTag("TimeoutException", () =>
            Effect.fail(
              new Errors.RequestTimeoutError({
                method: "POST",
                path: "/bookings",
              }),
            ),
          ),
          ensureBookingContract(),
        ),
      )
      .handle("confirm", ({ path }) =>
        Effect.gen(function* () {
          const service = yield* BookingService;
          const res = yield* service.confirmBooking(path.id);
          return toBookingResponse(res.booking);
        }).pipe(ensureBookingContract(path.id)),
      )
      .handle("cancel", ({ path, payload }) =>
        Effect.gen(function* () {
          const service = yield* BookingService;
          const res = yield* service.cancelBooking(path.id, payload.reason);
          return toBookingResponse(res);
        }).pipe(ensureBookingContract(path.id)),
      )
      .handle("getSummaryByPnr", ({ path }) =>
        Effect.gen(function* () {
          const queries = yield* BookingQueries;
          return yield* queries.getSummaryByPnr(path.pnr);
        }).pipe(ensureBookingContract()),
      )
      .handle("getPassengerHistory", ({ path }) =>
        Effect.gen(function* () {
          const queries = yield* BookingQueries;
          return yield* queries.getPassengerHistory(path.id);
        }).pipe(ensureBookingContract()),
      )
      .handle("searchByPassengerName", ({ urlParams }) =>
        Effect.gen(function* () {
          const queries = yield* BookingQueries;
          return yield* queries.searchByPassengerName(
            urlParams.name,
            urlParams.limit ?? 10,
          );
        }).pipe(ensureBookingContract()),
      )
      .handle("getByPnr", ({ path }) =>
        Effect.gen(function* () {
          const service = yield* BookingService;
          const res = yield* service.findByPnr(path.pnr);
          return toBookingResponse(res);
        }).pipe(ensureBookingContract()),
      ),
);
