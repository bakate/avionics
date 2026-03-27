import { BookingStatusSchema } from "@workspace/domain/booking";
import {
  BookingId,
  type CabinClass,
  CabinClassSchema,
  CurrencyCodeSchema,
  FlightId,
} from "@workspace/domain/kernel";
import { Schema } from "effect";
import { type BookingSummary } from "../../models/read-models.js";

import {
  type PassengerInput,
  type PassengerInput as PI,
} from "./schemas/passenger.schema.js";
import { type SearchParams as SP } from "./schemas/search.schema.js";
import {
  type FilterState as FS,
  type SortField as SF,
  type SortOrder as SO,
} from "./schemas/ui.schema.js";

export * from "./schemas/passenger.schema.js";
export * from "./schemas/search.schema.js";
export * from "./schemas/ui.schema.js";

/**
 * Lightweight flight representation stored in machine context.
 * Mirrors the FlightAvailability read model shape.
 */
export class FlightResult extends Schema.Class<FlightResult>("FlightResult")({
  flightId: FlightId,
  flightNumber: Schema.String,
  origin: Schema.String,
  destination: Schema.String,
  departureTime: Schema.String,
  arrivalTime: Schema.String,
  durationMinutes: Schema.Number,
  stops: Schema.Number,
  aircraft: Schema.optional(Schema.String),
  cabins: Schema.Array(
    Schema.Struct({
      cabin: CabinClassSchema,
      availableSeats: Schema.Number,
      price: Schema.Struct({
        amount: Schema.Number,
        currency: CurrencyCodeSchema,
      }),
    }),
  ),
  lastUpdated: Schema.String,
}) {}

/** A user's flight + cabin selection */
export class FlightSelection extends Schema.Class<FlightSelection>(
  "FlightSelection",
)({
  flight: FlightResult,
  cabin: CabinClassSchema,
  price: Schema.Struct({ amount: Schema.Number, currency: Schema.String }),
}) {}

export class BookingResult extends Schema.Class<BookingResult>("BookingResult")(
  {
    bookingId: BookingId,
    pnrCode: Schema.String, // Using Schema.String directly to avoid depending on specific domain validation shapes
    status: BookingStatusSchema,
    totalPrice: Schema.Struct({
      amount: Schema.Number,
      currency: CurrencyCodeSchema,
    }),
    confirmedAt: Schema.String,
    checkoutUrl: Schema.Union(Schema.String, Schema.Undefined),
  },
) {}

export type SubmitBookingInput = {
  readonly segments: ReadonlyArray<{
    readonly flightId: string;
    readonly cabinClass: CabinClass;
  }>;
  readonly passengers: ReadonlyArray<PassengerInput>;
};

// ---------------------------------------------------------------------------
// Context & Events
// ---------------------------------------------------------------------------

export type BookingContext = {
  searchParams: SP | null;
  outboundFlights: ReadonlyArray<FlightResult>;
  returnFlights: ReadonlyArray<FlightResult>;
  selectedOutbound: FlightSelection | null;
  selectedReturn: FlightSelection | null;
  passengers: ReadonlyArray<PI>;
  bookingResult: BookingResult | null;
  allBookings: ReadonlyArray<BookingSummary>;
  currentBooking: any | null; // using any to decouple from exact API shape
  pnrToFetch: string | null;
  userEmail: string | null;
  error: string | null;

  // UI State
  filters: FS;
  sortField: SF;
  sortOrder: SO;

  activeAction: {
    id: string;
    type: "confirm" | "cancel";
  } | null;
};

export type BookingEvent =
  | { type: "SEARCH"; params: SP }
  | { type: "FETCH_BOOKINGS"; email?: string | undefined }
  | { type: "FETCH_BOOKING_DETAILS"; pnr: string }
  | { type: "SELECT_OUTBOUND"; selection: FlightSelection }
  | { type: "SELECT_RETURN"; selection: FlightSelection }
  | { type: "SET_PASSENGERS"; passengers: ReadonlyArray<PI> }
  | { type: "CONFIRM_PAYMENT" }
  | { type: "CONFIRM_BOOKING_ACTION"; id: string }
  | { type: "CANCEL_BOOKING_ACTION"; id: string; reason: string }
  | { type: "CHANGE_OUTBOUND_DATE"; date: string }
  | { type: "CHANGE_RETURN_DATE"; date: string }
  | { type: "ERROR"; message: string }
  | { type: "RETRY" }
  | { type: "BACK" }
  | { type: "COMPLETE" }
  | { type: "RESET" }
  | { type: "UPDATE_FILTERS"; filters: FS }
  | { type: "UPDATE_SORT"; field: SF; order: SO }
  | { type: "RESET_FILTERS" };

export const initialContext: BookingContext = {
  searchParams: null,
  outboundFlights: [],
  returnFlights: [],
  selectedOutbound: null,
  selectedReturn: null,
  passengers: [],
  bookingResult: null,
  allBookings: [],
  currentBooking: null,
  pnrToFetch: null,
  userEmail: null, // this will be populated via external actions or provided input
  error: null,
  activeAction: null,
  filters: { cabinClass: "ECONOMY", maxStops: null, timeRange: null },
  sortField: "price",
  sortOrder: "asc",
};
