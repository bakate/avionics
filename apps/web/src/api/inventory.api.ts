import { type FlightAvailability } from "@workspace/application/read-models";
import { type AirportCode, type CabinClass } from "@workspace/domain/kernel";
import { Effect, Request, RequestResolver, Schema } from "effect";
import { makeClient } from "@/api/client";

export const DatePrice = Schema.Struct({
  date: Schema.String,
  lowestPrice: Schema.NullOr(
    Schema.Struct({
      amount: Schema.Number,
      currency: Schema.String,
    }),
  ),
});

export type DatePrice = typeof DatePrice.Type;

/**
 * Request identity for individual flight availability calls
 */
export interface GetFlightAvailabilityRequest extends Request.Request<
  FlightAvailability,
  any
> {
  readonly _tag: "GetFlightAvailabilityRequest";
  readonly flightId: string;
}

export const GetFlightAvailabilityRequest =
  Request.tagged<GetFlightAvailabilityRequest>("GetFlightAvailabilityRequest");

/**
 * Resolver for individual flight availability calls (Inventory API)
 */
const GetFlightAvailabilityResolver = RequestResolver.fromEffect(
  (req: GetFlightAvailabilityRequest) =>
    makeClient.pipe(
      Effect.flatMap((client) =>
        client.inventory.getFlightAvailability({
          path: { flightId: req.flightId },
        }),
      ),
    ),
);

/**
 * Get flight availability (Cached & Deduplicated)
 */
export const getFlightAvailability = (flightId: string) =>
  Effect.request(
    GetFlightAvailabilityRequest({ flightId }),
    GetFlightAvailabilityResolver,
  ).pipe(Effect.withRequestCaching(true));

/**
 * Get cabin availability
 */
export const getCabinAvailability = (flightId: string, cabin: CabinClass) =>
  makeClient.pipe(
    Effect.flatMap((client) =>
      client.inventory.getCabinAvailability({ path: { flightId, cabin } }),
    ),
  );

/**
 * Search flights
 */
export const findAvailableFlights = (params: {
  cabin: CabinClass;
  minSeats?: number;
  departureDate?: Date;
  origin?: AirportCode;
  destination?: AirportCode;
  limit?: number;
  sortBy?: string;
}) =>
  makeClient.pipe(
    Effect.flatMap((client) =>
      client.inventory.findAvailableFlights({
        urlParams: {
          cabinClass: params.cabin,
          minSeats: params.minSeats,
          departureDate: params.departureDate,
          origin: params.origin,
          destination: params.destination,
          limit: params.limit,
          sortBy: params.sortBy,
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
 */
export const getDatePrices = (params: {
  origin: AirportCode;
  destination: AirportCode;
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
