import { Effect } from "effect";
import { makeClient } from "@/api/client";

export type DatePrice = {
  readonly date: string;
  readonly lowestPrice: {
    readonly amount: number;
    readonly currency: string;
  } | null;
};

/**
 * Get flight availability
 */
export const getFlightAvailability = (flightId: string) =>
  makeClient.pipe(
    Effect.flatMap((client) =>
      client.inventory.getFlightAvailability({ path: { flightId } }),
    ),
  );

/**
 * Get cabin availability
 */
export const getCabinAvailability = (flightId: string, cabin: string) =>
  makeClient.pipe(
    Effect.flatMap((client) =>
      client.inventory.getCabinAvailability({ path: { flightId, cabin } }),
    ),
  );

/**
 * Search flights
 */
export const findAvailableFlights = (params: {
  cabin: string;
  minSeats?: number;
  departureDate?: Date;
  origin?: string;
  destination?: string;
}) =>
  makeClient.pipe(
    Effect.flatMap((client) =>
      client.inventory.findAvailableFlights({
        urlParams: {
          ...params,
          departureDate: params.departureDate
            ? params.departureDate.toISOString().split("T")[0]
            : undefined,
        },
      }),
    ),
  );

/**
 * Get inventory stats
 */
export const getInventoryStats = () =>
  makeClient.pipe(
    Effect.flatMap((client) => client.inventory.getInventoryStats({})),
  );

/**
 * Get lowest prices per day for a date range.
 * Calls findAvailableFlights for each date and extracts the minimum cabin price.
 * Used by the Date_Carousel component.
 *
 */
export const getDatePrices = (params: {
  origin: string;
  destination: string;
  dates: ReadonlyArray<string>;
}): Effect.Effect<ReadonlyArray<DatePrice>, never, never> =>
  Effect.gen(function* () {
    const results: Array<DatePrice> = [];

    for (const date of params.dates) {
      const flights = yield* findAvailableFlights({
        cabin: "ECONOMY",
        origin: params.origin,
        destination: params.destination,
        departureDate: new Date(date),
      }).pipe(Effect.catchAll(() => Effect.succeed([])));

      if (flights.length === 0) {
        results.push({ date, lowestPrice: null });
        continue;
      }

      let lowest: number | null = null;
      let currency = "EUR";

      for (const f of flights) {
        // Check economy price
        if (f.economyAvailable > 0) {
          const amt = f.economyPrice.amount;
          currency = f.economyPrice.currency;
          if (lowest === null || amt < lowest) lowest = amt;
        }
        // Check business price
        if (f.businessAvailable > 0) {
          const amt = f.businessPrice.amount;
          currency = f.businessPrice.currency;
          if (lowest === null || amt < lowest) lowest = amt;
        }
        // Check first price
        if (f.firstAvailable > 0) {
          const amt = f.firstPrice.amount;
          currency = f.firstPrice.currency;
          if (lowest === null || amt < lowest) lowest = amt;
        }
      }

      results.push({
        date,
        lowestPrice: lowest !== null ? { amount: lowest, currency } : null,
      });
    }

    return results;
  });
