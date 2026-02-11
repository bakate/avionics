/**
 * @file read-models.ts
 * @module @workspace/application/models
 * @description Read models for CQRS pattern - optimized for queries
 */

import { BookingStatusSchema } from "@workspace/domain/booking";
import {
  BookingId,
  CabinClassSchema,
  FlightId,
  Money,
  PnrCodeSchema,
} from "@workspace/domain/kernel";
import { Schema } from "effect";

// --- Booking Read Models ---

/**
 * Lightweight booking summary for list views
 */
export class BookingSummary extends Schema.Class<BookingSummary>(
  "BookingSummary",
)({
  id: BookingId,
  pnrCode: PnrCodeSchema,
  status: BookingStatusSchema,
  passengerCount: Schema.Number.pipe(Schema.int(), Schema.positive()),
  totalPrice: Money,
  createdAt: Schema.Date,
  expiresAt: Schema.OptionFromNullOr(Schema.Date),
}) {}

/**
 * Passenger booking history item
 */
export class PassengerBookingHistory extends Schema.Class<PassengerBookingHistory>(
  "PassengerBookingHistory",
)({
  bookingId: BookingId,
  pnrCode: PnrCodeSchema,
  status: BookingStatusSchema,
  flightNumbers: Schema.Array(Schema.String),
  totalPrice: Money,
  bookedAt: Schema.Date,
}) {}

// --- Inventory Read Models ---

/**
 * Flight availability summary
 */
export class FlightAvailability extends Schema.Class<FlightAvailability>(
  "FlightAvailability",
)({
  flightId: FlightId,
  economyAvailable: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  businessAvailable: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  firstAvailable: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  economyPrice: Money,
  businessPrice: Money,
  firstPrice: Money,
  lastUpdated: Schema.Date,
}) {}

/**
 * Cabin availability detail
 */
export class CabinAvailability extends Schema.Class<CabinAvailability>(
  "CabinAvailability",
)({
  cabin: CabinClassSchema,
  available: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  capacity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  price: Money,
  utilizationPercent: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.lessThanOrEqualTo(100),
  ),
}) {}

/**
 * Global inventory statistics
 */
export class InventoryStats extends Schema.Class<InventoryStats>(
  "InventoryStats",
)({
  totalFlights: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  totalSeatsAvailable: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  averageUtilization: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.lessThanOrEqualTo(100),
  ),
  fullFlights: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
}) {}
