/**
 * @file events.ts
 * @module @workspace/domain/events
 * @description Domain Events for Event-Driven Architecture
 */

import { Schema } from "effect";
import {
  BookingId,
  CabinClassSchema,
  FlightId,
  PnrCodeSchema,
} from "./kernel.js";

const EventId = Schema.String.pipe(Schema.brand("EventId"));
export type EventId = typeof EventId.Type;
const aggregateTypes = Schema.Literal("Booking", "FlightInventory");

/**
 * Base class for all booking-related events
 */
export class BookingEventBase extends Schema.Class<BookingEventBase>(
  "BookingEventBase",
)({
  eventId: EventId,
  occurredAt: Schema.Union(Schema.Date, Schema.DateFromString),
  bookingId: BookingId,
  pnrCode: PnrCodeSchema,
  aggregateType: aggregateTypes.pipe(Schema.pickLiteral("Booking")),
  aggregateId: Schema.String,
}) {}

/**
 * Base class for all flight inventory-related events
 */
export class InventoryEventBase extends Schema.Class<InventoryEventBase>(
  "InventoryEventBase",
)({
  eventId: EventId,
  occurredAt: Schema.Union(Schema.Date, Schema.DateFromString),
  aggregateId: Schema.String,
  flightId: FlightId,
  cabin: CabinClassSchema,
  aggregateType: aggregateTypes.pipe(Schema.pickLiteral("FlightInventory")),
  quantity: Schema.Number,
}) {}

// ============================================================================
// Booking Events
// ============================================================================

/**
 * Emitted when a new booking is created in the system.
 * At this point, seats are held but not yet confirmed.
 */
export class BookingCreated extends BookingEventBase.extend<BookingCreated>(
  "BookingCreated",
)({}) {}

/**
 * Emitted when a booking is confirmed and payment is processed.
 * Seats transition from held to confirmed state.
 */
export class BookingConfirmed extends BookingEventBase.extend<BookingConfirmed>(
  "BookingConfirmed",
)({}) {}

/**
 * Emitted when a booking is cancelled.
 */
export class BookingCancelled extends BookingEventBase.extend<BookingCancelled>(
  "BookingCancelled",
)({
  reason: Schema.String,
}) {}

/**
 * Emitted when a booking expires without being confirmed.
 */
export class BookingExpired extends BookingEventBase.extend<BookingExpired>(
  "BookingExpired",
)({
  expiredAt: Schema.Union(Schema.Date, Schema.DateFromString),
}) {}

// ============================================================================
// Inventory Events
// ============================================================================

export class SeatsHeld extends InventoryEventBase.extend<SeatsHeld>(
  "SeatsHeld",
)({}) {}

export class SeatsReleased extends InventoryEventBase.extend<SeatsReleased>(
  "SeatsReleased",
)({}) {}

// Union of all domain events
export const DomainEventSchema = Schema.Union(
  BookingCreated,
  BookingConfirmed,
  BookingCancelled,
  BookingExpired,
  SeatsHeld,
  SeatsReleased,
);

export type DomainEventType = typeof DomainEventSchema.Type;
