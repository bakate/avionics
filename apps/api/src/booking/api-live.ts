import { HttpApiBuilder } from "@effect/platform";
import {
  BookingService,
  type BookingServiceImpl,
} from "@workspace/application/booking.service";
import { BookingQueries } from "@workspace/application/booking-queries";
import * as Errors from "@workspace/domain/errors";
import { BookingId, makePnrCode } from "@workspace/domain/kernel";
import { Effect } from "effect";
import { Api } from "../api.js";

// ============================================================================
// Helpers: Extract services
// ============================================================================

const withBookingService = <A, E, R>(
  fn: (service: BookingServiceImpl) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const service = yield* BookingService;
    return yield* fn(service);
  });

const withBookingQueries = <A, E, R>(
  fn: (queries: typeof BookingQueries.Service) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const queries = yield* BookingQueries;
    return yield* fn(queries);
  });

// ============================================================================
// Helper: Map unexpected errors to PersistenceError
// Ensures we only return errors allowed by the HttpApi contract.
// ============================================================================

const ensureContractErrors =
  (bookingId: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.catchAll((e: unknown): Effect.Effect<A, any, R> => {
        if (e && typeof e === "object" && "_tag" in e) {
          const tag = (e as any)._tag;
          const allowedTags = [
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
          ];
          if (allowedTags.includes(tag)) {
            return Effect.fail(e);
          }
          return Effect.fail(
            new Errors.BookingPersistenceError({
              bookingId,
              reason: (e as any).message || String(tag),
            }),
          );
        }

        return Effect.fail(
          new Errors.BookingPersistenceError({
            bookingId,
            reason: e instanceof Error ? e.message : String(e),
          }),
        );
      }),
    );

// ============================================================================
// API Handlers
// ============================================================================

export const BookingApiLive = HttpApiBuilder.group(
  Api,
  "bookings",
  (handlers) =>
    handlers
      .handle("list", () =>
        withBookingService((service) => service.findAll()).pipe(
          ensureContractErrors("all"),
        ),
      )
      .handle("book", ({ payload }) =>
        withBookingService((service) =>
          service.bookFlight(payload).pipe(
            Effect.map((res) => ({
              booking: res.booking,
              checkoutUrl: res.checkout?.checkoutUrl,
              checkoutId: res.checkout?.id,
            })),
          ),
        ).pipe(
          Effect.catchTag("TimeoutException", () =>
            Effect.fail(
              new Errors.RequestTimeoutError({
                method: "POST",
                path: "/bookings",
              }),
            ),
          ),
          ensureContractErrors("new"),
        ),
      )
      .handle("confirm", ({ path }) =>
        withBookingService((service) =>
          service
            .confirmBooking(BookingId.make(path.id))
            .pipe(Effect.map((res) => res.booking)),
        ).pipe(ensureContractErrors(path.id)),
      )
      .handle("getSummaryByPnr", ({ path }) =>
        withBookingQueries((queries) =>
          queries.getSummaryByPnr(makePnrCode(path.pnr)),
        ).pipe(ensureContractErrors(path.pnr)),
      )
      .handle("getPassengerHistory", ({ path }) =>
        withBookingQueries((queries) =>
          queries.getPassengerHistory(path.id),
        ).pipe(ensureContractErrors(path.id)),
      )
      .handle("searchByPassengerName", ({ urlParams }) =>
        withBookingQueries((queries) =>
          queries.searchByPassengerName(urlParams.name, urlParams.limit ?? 10),
        ).pipe(ensureContractErrors(urlParams.name)),
      ),
);
