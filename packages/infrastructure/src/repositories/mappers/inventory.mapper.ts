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
        // TODO: Implement persistent inventory prices in the flight_inventory table.
        // Currently, we default to 0 because the schema lacks price columns,
        // but this should be replaced with real value from DB once columns are added.
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
