import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { BookFlightCommand } from "@workspace/application/booking.service";
import * as PaymentErrors from "@workspace/application/payment.gateway";
import {
  BookingSummary,
  PassengerBookingHistory,
} from "@workspace/application/read-models";
import { BookingStatusSchema } from "@workspace/domain/booking";
import * as Errors from "@workspace/domain/errors";
import { BookingId, PnrCodeSchema } from "@workspace/domain/kernel";
import { Passenger } from "@workspace/domain/passenger";
import { BookingSegment } from "@workspace/domain/segment";
import { Schema } from "effect";

export class BookingResponse extends Schema.Class<BookingResponse>(
  "BookingResponse",
)({
  id: BookingId,
  pnrCode: PnrCodeSchema,
  status: BookingStatusSchema,
  passengers: Schema.NonEmptyArray(Passenger),
  segments: Schema.NonEmptyArray(BookingSegment),
  expiresAt: Schema.Option(Schema.Date),
  createdAt: Schema.Date,
}) {}

export class BookResponse extends Schema.Class<BookResponse>("BookResponse")({
  booking: BookingResponse,
  checkoutUrl: Schema.optional(Schema.String),
  checkoutId: Schema.optional(Schema.String),
}) {}

const MAX_SEARCH_LIMIT = 100;

export class BookingGroup extends HttpApiGroup.make("bookings")
  .add(
    HttpApiEndpoint.get("list", "/")
      .addSuccess(Schema.Array(BookingResponse))
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
      .addError(PaymentErrors.PaymentDeclinedError, { status: 402 })
      .addError(PaymentErrors.PaymentApiUnavailableError, { status: 503 })
      .addError(PaymentErrors.CheckoutNotFoundError, { status: 404 })
      .addError(PaymentErrors.UnsupportedCurrencyError, { status: 400 }),
  )
  .add(
    HttpApiEndpoint.post("confirm", "/:id/confirm")
      .setPath(Schema.Struct({ id: BookingId }))
      .addSuccess(BookingResponse)
      .addError(Errors.BookingNotFoundError, { status: 404 })
      .addError(Errors.BookingStatusError, { status: 400 })
      .addError(Errors.BookingExpiredError, { status: 410 })
      .addError(Errors.BookingPersistenceError, { status: 500 })
      .addError(Errors.OptimisticLockingError, { status: 409 })
      .addError(Errors.FlightFullError, { status: 409 })
      .addError(Errors.FlightNotFoundError, { status: 404 })
      .addError(Errors.InvalidAmountError, { status: 400 })
      .addError(Errors.InventoryOvercapacityError, { status: 409 })
      .addError(Errors.InventoryPersistenceError, { status: 500 })
      .addError(Errors.RequestTimeoutError, { status: 504 })
      .addError(PaymentErrors.PaymentDeclinedError, { status: 402 })
      .addError(PaymentErrors.PaymentApiUnavailableError, { status: 503 })
      .addError(PaymentErrors.CheckoutNotFoundError, { status: 404 })
      .addError(PaymentErrors.UnsupportedCurrencyError, { status: 400 }),
  )
  .add(
    HttpApiEndpoint.get("getSummaryByPnr", "/pnr/:pnr")
      .setPath(Schema.Struct({ pnr: PnrCodeSchema }))
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
