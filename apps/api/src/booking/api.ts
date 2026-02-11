import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { BookFlightCommand } from "@workspace/application/booking.service";
import * as PaymentErrors from "@workspace/application/payment.gateway";
import {
  BookingSummary,
  PassengerBookingHistory,
} from "@workspace/application/read-models";
import { Booking } from "@workspace/domain/booking";
import * as Errors from "@workspace/domain/errors";
import { Schema } from "effect";

export class BookResponse extends Schema.Class<BookResponse>("BookResponse")({
  booking: Booking,
  checkoutUrl: Schema.optional(Schema.String),
  checkoutId: Schema.optional(Schema.String),
}) {}

const MAX_SEARCH_LIMIT = 100;

export class BookingGroup extends HttpApiGroup.make("bookings")
  .add(
    HttpApiEndpoint.get("list", "/")
      .addSuccess(Schema.Array(Booking))
      .addError(Errors.BookingPersistenceError, { status: 500 }),
  )
  .add(
    HttpApiEndpoint.post("book", "/")
      .setPayload(BookFlightCommand)
      .addSuccess(BookResponse)
      .addError(Errors.FlightFullError, { status: 409 })
      .addError(Errors.FlightNotFoundError, { status: 404 })
      .addError(Errors.OptimisticLockingError, { status: 409 })
      .addError(Errors.BookingExpiredError, { status: 410 })
      .addError(Errors.InvalidAmountError, { status: 400 })
      .addError(Errors.BookingPersistenceError, { status: 500 })
      .addError(Errors.BookingNotFoundError, { status: 404 })
      .addError(Errors.BookingStatusError, { status: 400 })
      .addError(Errors.InventoryOvercapacityError, { status: 409 })
      .addError(Errors.InventoryPersistenceError, { status: 500 })
      .addError(Errors.RequestTimeoutError, { status: 504 })
      // Payment Errors
      .addError(PaymentErrors.PaymentDeclinedError, { status: 402 })
      .addError(PaymentErrors.PaymentApiUnavailableError, { status: 503 })
      .addError(PaymentErrors.CheckoutNotFoundError, { status: 404 })
      .addError(PaymentErrors.UnsupportedCurrencyError, { status: 400 }),
  )
  .add(
    HttpApiEndpoint.post("confirm", "/:id/confirm")
      .setPath(Schema.Struct({ id: Schema.String }))
      .addSuccess(Booking) // Returns confirmed booking
      .addError(Errors.BookingNotFoundError, { status: 404 })
      .addError(Errors.BookingStatusError, { status: 400 })
      .addError(Errors.BookingExpiredError, { status: 410 })
      .addError(Errors.BookingPersistenceError, { status: 500 })
      .addError(Errors.OptimisticLockingError, { status: 409 }),
  )
  .add(
    HttpApiEndpoint.get("getSummaryByPnr", "/pnr/:pnr")
      .setPath(Schema.Struct({ pnr: Schema.String }))
      .addSuccess(BookingSummary)
      .addError(Errors.BookingNotFoundError, { status: 404 })
      .addError(Errors.BookingPersistenceError, { status: 500 }),
  )
  .add(
    HttpApiEndpoint.get("getPassengerHistory", "/passenger/:id")
      .setPath(Schema.Struct({ id: Schema.String }))
      .addSuccess(Schema.Array(PassengerBookingHistory))
      .addError(Errors.BookingPersistenceError, { status: 500 }),
  )
  .add(
    HttpApiEndpoint.get("searchByPassengerName", "/search")
      .setUrlParams(
        Schema.Struct({
          name: Schema.String,
          limit: Schema.optional(
            Schema.NumberFromString.pipe(
              Schema.int(),
              Schema.positive(),
              Schema.lessThanOrEqualTo(MAX_SEARCH_LIMIT),
            ),
          ),
        }),
      )
      .addSuccess(Schema.Array(BookingSummary))
      .addError(Errors.BookingPersistenceError, { status: 500 }),
  )
  .prefix("/bookings") {}
