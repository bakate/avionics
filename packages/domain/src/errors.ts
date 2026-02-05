import { Schema } from "effect";

// --- Kernel / Primitives Errors ---

export class CurrencyMismatchError extends Schema.TaggedError<CurrencyMismatchError>()(
  "CurrencyMismatchError",
  {
    expected: Schema.String,
    actual: Schema.String,
  },
) {}

export class InventoryOvercapacityError extends Schema.TaggedError<InventoryOvercapacityError>()(
  "InventoryOvercapacityError",
  {
    flightId: Schema.String,
    cabin: Schema.String,
    requested: Schema.Number,
    available: Schema.Number,
    capacity: Schema.Number,
  },
) {}

export class OptimisticLockingError extends Schema.TaggedError<OptimisticLockingError>()(
  "OptimisticLockingError",
  {
    entityType: Schema.String,
    id: Schema.String,
    expectedVersion: Schema.Number,
    actualVersion: Schema.Number,
  },
) {}

// --- Inventory Errors ---

export class FlightFullError extends Schema.TaggedError<FlightFullError>()(
  "FlightFullError",
  {
    flightId: Schema.String,
    cabin: Schema.String,
    requested: Schema.Number,
    available: Schema.Number,
  },
) {}

export class InvalidAmountError extends Schema.TaggedError<InvalidAmountError>()(
  "InvalidAmountError",
  {
    amount: Schema.Number,
  },
) {}

export class FlightNotFoundError extends Schema.TaggedError<FlightNotFoundError>()(
  "FlightNotFoundError",
  {
    flightId: Schema.String,
  },
) {}

// --- Booking Errors ---

export class BookingNotFoundError extends Schema.TaggedError<BookingNotFoundError>()(
  "BookingNotFoundError",
  {
    searchkey: Schema.String,
  },
) {}

export class BookingExpiredError extends Schema.TaggedError<BookingExpiredError>()(
  "BookingExpiredError",
  {
    pnrCode: Schema.String,
    expiresAt: Schema.Date,
  },
) {}

export class BookingStatusError extends Schema.TaggedError<BookingStatusError>()(
  "BookingStatusError",
  {
    pnrCode: Schema.String,
    status: Schema.String,
    expected: Schema.String,
  },
) {}

// --- Ticketing Errors ---

export class TicketAlreadyIssuedError extends Schema.TaggedError<TicketAlreadyIssuedError>()(
  "TicketAlreadyIssuedError",
  {
    pnrCode: Schema.String,
  },
) {}

// --- Persistence Errors ---

export class BookingPersistenceError extends Schema.TaggedError<BookingPersistenceError>()(
  "BookingPersistenceError",
  {
    bookingId: Schema.String,
    reason: Schema.String,
  },
) {}

export class InventoryPersistenceError extends Schema.TaggedError<InventoryPersistenceError>()(
  "InventoryPersistenceError",
  {
    flightId: Schema.String,
    reason: Schema.String,
  },
) {}

export class RequestTimeoutError extends Schema.TaggedError<RequestTimeoutError>()(
  "RequestTimeoutError",
  {
    method: Schema.String,
    path: Schema.String,
  },
) {}
