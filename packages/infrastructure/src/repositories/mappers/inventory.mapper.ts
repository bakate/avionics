import { FlightInventory, SeatBucket } from "@workspace/domain/inventory";
import { type FlightId, Money } from "@workspace/domain/kernel";

// --- Database Row Types ---

export interface FlightInventoryRow {
  readonly flight_id: string;

  // Economy
  readonly economy_total: number;
  readonly economy_available: number;

  // Business
  readonly business_total: number;
  readonly business_available: number;

  // First
  readonly first_total: number;
  readonly first_available: number;

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
        // Price is not in inventory table in this schema?
        // In real app, price is dynamic. For this exercise, we might need a default or fetch from elsewhere.
        // Assuming fixed for now or logic handled in Pricing Context.
        // However, Domain entity requires it. We'll use a placeholder or check if schema needs update.
        // Looking at integration test, it was creating seat buckets with price.
        // But schema.sql DOES NOT have price columns.
        // We will default to 0 or a base price, acknowledging this limitation.
        price: Money.of(0, "EUR"),
      }),
      business: new SeatBucket({
        available: row.business_available,
        capacity: row.business_total,
        price: Money.of(0, "EUR"),
      }),
      first: new SeatBucket({
        available: row.first_available,
        capacity: row.first_total,
        price: Money.of(0, "EUR"),
      }),
    },
    domainEvents: [],
  });
};
