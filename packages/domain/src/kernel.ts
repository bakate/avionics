/**
 * @file kernel.ts
 * @module @workspace/domain/kernel
 * @description The "Shared Kernel" (DDD Pattern).
 *
 * This file contains the ubiquitous language definitions that are shared across
 * multiple Bounded Contexts (Supply, Demand, Contract).
 *
 * Why not "utils.ts"?
 * - Utils are usually generic helpers (date formatting, string manipulation).
 * - Kernel contains DOMAIN CONCEPTS (Money, CabinClass, AirportCode).
 * - These types have business rules (e.g., Money cannot be negative, AirportCode is 3 chars).
 * - Changes here ripple across the entire system.
 */

import { Schema } from "effect";
import { CurrencyMismatchError } from "./errors.js";

// =============================================================================
// PRIMITIVE VALUE OBJECTS (Scalars with Rules)
// =============================================================================

// --- Aggregate IDs ---
export const BookingId = Schema.String.pipe(Schema.brand("BookingId"));
export type BookingId = typeof BookingId.Type;
export const makeBookingId = (id: string): BookingId => BookingId.make(id);

export const FlightId = Schema.String.pipe(Schema.brand("FlightId"));
export type FlightId = typeof FlightId.Type;
export const makeFlightId = (id: string): FlightId => FlightId.make(id);

export const SegmentId = Schema.String.pipe(Schema.brand("SegmentId"));
export type SegmentId = typeof SegmentId.Type;
export const makeSegmentId = (id: string): SegmentId => SegmentId.make(id);

// --- Airport Code (IATA) ---
export const AirportCodeSchema = Schema.String.pipe(
  Schema.pattern(/^[A-Z]{3}$/),
  Schema.brand("AirportCode"),
);
export type AirportCode = typeof AirportCodeSchema.Type;

// --- Email Address ---
export const EmailSchema = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  Schema.brand("Email"),
);
export type Email = typeof EmailSchema.Type;

// --- PNR Code (Booking Reference) ---
export const PnrCodeSchema = Schema.String.pipe(
  Schema.pattern(/^[A-Z0-9]{6}$/),
  Schema.brand("PnrCode"),
);
export type PnrCode = typeof PnrCodeSchema.Type;

// =============================================================================
// DOMAIN ENUMS (Finite Sets)
// =============================================================================

// --- Cabin Class ---
export const CabinClass = {
  ECONOMY: "ECONOMY",
  BUSINESS: "BUSINESS",
  FIRST: "FIRST",
} as const;

export type CabinClass = (typeof CabinClass)[keyof typeof CabinClass];

export const CabinClassSchema = Schema.Enums(CabinClass);

// --- Passenger Type ---
export const PassengerType = {
  INFANT: "INFANT", // 0-23 months
  CHILD: "CHILD", // 2-11 years
  YOUNG_ADULT: "YOUNG_ADULT", // 12-17 years
  ADULT: "ADULT", // 18-64 years
  SENIOR: "SENIOR", // 65+ years
} as const;

export type PassengerType = (typeof PassengerType)[keyof typeof PassengerType];

export const PassengerTypeSchema = Schema.Enums(PassengerType);

// --- Gender ---
export const Gender = {
  MALE: "MALE",
  FEMALE: "FEMALE",
} as const;

export type Gender = (typeof Gender)[keyof typeof Gender];

export const GenderSchema = Schema.Enums(Gender);

// =============================================================================
// COMPLEX VALUE OBJECTS (Structs with Invariants)
// =============================================================================

// --- Currency Code (ISO 4217) ---
export const SupportedCurrencies = ["EUR", "USD", "GBP", "CHF"] as const;
export const CurrencyCodeSchema = Schema.Literal(...SupportedCurrencies);
export type CurrencyCode = typeof CurrencyCodeSchema.Type;

// --- Money ---
export class Money extends Schema.Class<Money>("Money")({
  amount: Schema.Number.pipe(Schema.nonNegative()),
  currency: CurrencyCodeSchema,
}) {
  // Private constructor - use static factory methods
  private constructor(props: { amount: number; currency: CurrencyCode }) {
    super(props);
  }

  static readonly zero = (currency: CurrencyCode): Money => {
    return new Money({ amount: 0, currency });
  };

  static of(amount: number, currency: CurrencyCode): Money {
    if (amount < 0) {
      throw new Error("Money amount cannot be negative");
    }
    return new Money({ amount, currency });
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError({
        expected: this.currency,
        actual: other.currency,
      });
    }
    return Money.of(this.amount + other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return Money.of(Math.round(this.amount * factor), this.currency);
  }

  /**
   * Converts the amount to cents (integer) safely handling floating point precision.
   * Assumes the amount is in major units (e.g. 10.50).
   */
  toCents(): number {
    return Math.round(this.amount * 100);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  isPositive(): boolean {
    return this.amount > 0;
  }
}

// --- Route (Origin -> Destination) ---
export class Route extends Schema.Class<Route>("Route")({
  origin: AirportCodeSchema,
  destination: AirportCodeSchema,
}) {
  static readonly schema = this.pipe(
    Schema.filter((r) => r.origin !== r.destination, {
      message: () => "Origin and Destination must be different",
    }),
  );

  private constructor(props: {
    origin: AirportCode;
    destination: AirportCode;
  }) {
    super(props);
  }

  static create(props: {
    origin: AirportCode;
    destination: AirportCode;
  }): Route {
    return Schema.validateSync(Route.schema)(new Route(props));
  }
}

// --- Schedule (Time Window) ---
export class Schedule extends Schema.Class<Schedule>("Schedule")({
  departure: Schema.Date,
  arrival: Schema.Date,
}) {
  static readonly schema = this.pipe(
    Schema.filter((s) => s.arrival > s.departure, {
      message: () => "Arrival must be after departure",
    }),
  );

  private constructor(props: { departure: Date; arrival: Date }) {
    super(props);
  }

  static create(props: { departure: Date; arrival: Date }): Schedule {
    return Schema.validateSync(Schedule.schema)(new Schedule(props));
  }
}
