import { BookingSummary } from "@workspace/application/read-models";
import { CabinClassSchema } from "@workspace/domain/kernel";
import { Schema } from "effect";
import { PassengerInput } from "../schemas/passenger.schema";
import { SearchParams } from "../schemas/search.schema";

// --- Sub-schemas for the machine context ---

export const FlightResultSchema = Schema.Struct({
  flightId: Schema.String,
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
      price: Schema.Struct({ amount: Schema.Number, currency: Schema.String }),
    }),
  ),
  lastUpdated: Schema.String,
});

export const FlightSelectionSchema = Schema.Struct({
  flight: FlightResultSchema,
  cabin: CabinClassSchema,
  price: Schema.Struct({ amount: Schema.Number, currency: Schema.String }),
});

export const BookingResultSchema = Schema.Struct({
  bookingId: Schema.String,
  pnrCode: Schema.String,
  status: Schema.String,
  totalPrice: Schema.Struct({ amount: Schema.Number, currency: Schema.String }),
  confirmedAt: Schema.String,
  checkoutUrl: Schema.optional(Schema.String),
});

export const BookingContextPersistenceSchema = Schema.Struct({
  searchParams: Schema.NullOr(SearchParams),
  outboundFlights: Schema.Array(FlightResultSchema),
  returnFlights: Schema.Array(FlightResultSchema),
  selectedOutbound: Schema.NullOr(FlightSelectionSchema),
  selectedReturn: Schema.NullOr(FlightSelectionSchema),
  passengers: Schema.Array(PassengerInput),
  bookingResult: Schema.NullOr(BookingResultSchema),
  allBookings: Schema.Array(BookingSummary),
  userEmail: Schema.NullOr(Schema.String),
  error: Schema.NullOr(Schema.String),
}) as Schema.Schema<any, any, never>;

const decodeContext = Schema.decodeUnknownSync(BookingContextPersistenceSchema);
const encodeContext = Schema.encodeSync(BookingContextPersistenceSchema);

const STORAGE_KEY = "avionics-booking-session";
const LAST_EMAIL_KEY = "avionics-last-email";

export const saveLastEmail = (email: string) => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(LAST_EMAIL_KEY, email);
  }
};

export const loadLastEmail = (): string | null => {
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem(LAST_EMAIL_KEY);
  }
  return null;
};

export const saveBookingState = (snapshot: any) => {
  try {
    if (!snapshot || !snapshot.context) return;

    // 1. Encode context to JSON-friendly format
    const encodedContext = encodeContext(snapshot.context);

    // 2. Create the persisted snapshot object
    const snapshotToStore = {
      ...snapshot,
      context: encodedContext,
    };

    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotToStore));
    }
  } catch (e) {
    console.warn("[Persistence] Failed to save state", e);
  }
};

export const loadBookingState = (): any => {
  try {
    const saved =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(STORAGE_KEY)
        : null;
    if (!saved) return undefined;

    const parsed = JSON.parse(saved);
    if (!parsed || !parsed.context) return undefined;

    // 1. Re-hydrate complex types in context
    const rehydratedContext = decodeContext(parsed.context);

    // 2. Return the snapshot ready for XState createActor
    return {
      ...parsed,
      context: rehydratedContext,
    };
  } catch (e) {
    console.error("[Persistence] Failed to load state, clearing storage", e);
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    return undefined;
  }
};

export const clearBookingState = () => {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(STORAGE_KEY);
  }
};
