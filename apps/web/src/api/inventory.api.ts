import { Effect } from "effect";
import { makeClient } from "./client";

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
