/**
 * Hook bridging Effect-based flight search API to React state.
 *
 * Calls the inventory API to search for flights, converts the Effect program
 * to a Promise, and incrementally updates the flight list as results arrive.
 * Handles stream completion and errors. Cleans up on unmount.
 *
 * Requirements: 1.2, 1.3
 */

import { type FlightAvailability } from "@workspace/application/read-models";
import { type CabinClass } from "@workspace/domain/kernel";
import { Effect } from "effect";
import { findAvailableFlights } from "@/api/inventory.api";
import { type FlightResult } from "@/features/booking/machines/booking.machine";
import { type SearchParams } from "@/features/booking/schemas/search.schema";
import { useAction } from "@/lib/effect-hooks";

// ---------------------------------------------------------------------------
// Adapter: API response → FlightResult
// ---------------------------------------------------------------------------

const ensureISO = (d: Date | string | undefined | null): string => {
  if (!d) return "";
  if (d instanceof Date) return d.toISOString();
  return new Date(d).toISOString();
};

/**
 * Convert an API FlightAvailability response to the lightweight FlightResult
 * stored in the booking machine context.
 */
const toFlightResult = (raw: FlightAvailability): FlightResult => ({
  flightId: raw.flightId,
  flightNumber: raw.flightNumber,
  origin: raw.origin,
  destination: raw.destination,
  departureTime: ensureISO(raw.departureTime),
  arrivalTime: ensureISO(raw.arrivalTime),
  durationMinutes: raw.durationMinutes,
  stops: raw.stops,
  cabins: [
    {
      cabin: "ECONOMY" as CabinClass,
      availableSeats: raw.economyAvailable,
      price: {
        amount: raw.economyPrice.amount,
        currency: raw.economyPrice.currency,
      },
    },
    {
      cabin: "BUSINESS" as CabinClass,
      availableSeats: raw.businessAvailable,
      price: {
        amount: raw.businessPrice.amount,
        currency: raw.businessPrice.currency,
      },
    },
    {
      cabin: "FIRST" as CabinClass,
      availableSeats: raw.firstAvailable,
      price: {
        amount: raw.firstPrice.amount,
        currency: raw.firstPrice.currency,
      },
    },
  ],
  lastUpdated: ensureISO(raw.lastUpdated),
});

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useFlightStream = () => {
  const {
    execute: searchAction,
    data,
    isLoading,
    error,
  } = useAction((params: SearchParams) => {
    const cabin = params.cabinClass ?? ("ECONOMY" as CabinClass);
    const totalPassengers =
      params.passengers.adults +
      params.passengers.children +
      params.passengers.infants;

    return findAvailableFlights({
      cabin,
      minSeats: totalPassengers,
      departureDate: new Date(params.departureDate),
      origin: params.origin,
      destination: params.destination,
    }).pipe(Effect.map((results) => results.map(toFlightResult)));
  });

  return {
    flights: data ?? [],
    isLoading,
    error,
    isComplete: !isLoading && data !== null,
    search: searchAction,
  } as const;
};
