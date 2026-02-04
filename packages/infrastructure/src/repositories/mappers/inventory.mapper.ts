import { FlightInventory, SeatBucket } from "@workspace/domain/inventory";
import {
  type CurrencyCode,
  type FlightId,
  Money,
} from "@workspace/domain/kernel";

// --- Database Row Types ---

export interface FlightInventoryRow {
  readonly flight_id: string;

  // Economy
  readonly economy_total: number;
  readonly economy_available: number;
  readonly economy_price_amount: string | number;
  readonly economy_price_currency: string;

  // Business
  readonly business_total: number;
  readonly business_available: number;
  readonly business_price_amount: string | number;
  readonly business_price_currency: string;

  // First
  readonly first_total: number;
  readonly first_available: number;
  readonly first_price_amount: string | number;
  readonly first_price_currency: string;

  readonly version: number;
}

// --- Mappers ---

export const toDomain = (row: FlightInventoryRow): FlightInventory => {
  return new FlightInventory({
    flightId: row.flight_id as FlightId,
    version: row.version,
    availability: {
      economy: new SeatBucket({
        available: row.economy_available,
        capacity: row.economy_total,
        price: Money.of(
          Number(row.economy_price_amount),
          row.economy_price_currency as CurrencyCode,
        ),
      }),
      business: new SeatBucket({
        available: row.business_available,
        capacity: row.business_total,
        price: Money.of(
          Number(row.business_price_amount),
          row.business_price_currency as CurrencyCode,
        ),
      }),
      first: new SeatBucket({
        available: row.first_available,
        capacity: row.first_total,
        price: Money.of(
          Number(row.first_price_amount),
          row.first_price_currency as CurrencyCode,
        ),
      }),
    },
    domainEvents: [],
  });
};
