import { FlightInventory, SeatBucket } from "@workspace/domain/inventory";
import { AirportCodeSchema, FlightId, Money } from "@workspace/domain/kernel";
import { Option, Schema } from "effect";

export interface CreateTestInventoryOptions {
  readonly flightId?: string;
  readonly economyTotal?: number;
  readonly economyAvailable?: number;
  readonly economyPrice?: number;
  readonly businessTotal?: number;
  readonly businessAvailable?: number;
  readonly businessPrice?: number;
  readonly firstTotal?: number;
  readonly firstAvailable?: number;
  readonly firstPrice?: number;
}

/**
 * Create a test flight inventory with default values
 */
export const createTestInventory = ({
  flightId = "FL001",
  economyTotal = 100,
  economyAvailable,
  economyPrice = 100,
  businessTotal = 20,
  businessAvailable,
  businessPrice = 500,
  firstTotal = 10,
  firstAvailable,
  firstPrice = 1000,
}: CreateTestInventoryOptions = {}): FlightInventory => {
  return new FlightInventory({
    flightId: Schema.decodeSync(FlightId)(flightId),
    origin: Schema.decodeSync(AirportCodeSchema)("CDG"),
    destination: Schema.decodeSync(AirportCodeSchema)("JFK"),
    availability: {
      economy: new SeatBucket({
        capacity: economyTotal,
        available: economyAvailable ?? economyTotal,
        price: Money.of(economyPrice, "EUR"),
      }),
      business: new SeatBucket({
        capacity: businessTotal,
        available: businessAvailable ?? businessTotal,
        price: Money.of(businessPrice, "EUR"),
      }),
      first: new SeatBucket({
        capacity: firstTotal,
        available: firstAvailable ?? firstTotal,
        price: Money.of(firstPrice, "EUR"),
      }),
    },
    flightNumber: Option.none(),
    departureTime: Option.none(),
    arrivalTime: Option.none(),
    durationMinutes: Option.none(),
    stops: Option.none(),
    version: 0,
    domainEvents: [],
  });
};
