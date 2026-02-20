/**
 * Hook bridging Effect-based flight search API to React state.
 *
 * Calls the inventory API to search for flights, converts the Effect program
 * to a Promise, and incrementally updates the flight list as results arrive.
 * Handles stream completion and errors. Cleans up on unmount.
 *
 * Requirements: 1.2, 1.3
 */

import { FetchHttpClient } from "@effect/platform";
import { type FlightAvailability } from "@workspace/application/read-models";
import { Effect } from "effect";
import { useCallback, useEffect, useRef, useState } from "react";
import { findAvailableFlights } from "../../../api/inventory.api.ts";
import { type FlightResult } from "../machines/booking.machine.ts";
import { type SearchParams } from "../schemas/search.schema.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FlightStreamState = {
  /** Flights received so far */
  flights: ReadonlyArray<FlightResult>;
  /** Whether the stream is still active */
  isLoading: boolean;
  /** Error message if the stream failed */
  error: string | null;
  /** Whether the stream completed (no more results) */
  isComplete: boolean;
};

const initialState: FlightStreamState = {
  flights: [],
  isLoading: false,
  error: null,
  isComplete: false,
};

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
  departureTime: ensureISO(raw.departureTime),
  arrivalTime: ensureISO(raw.arrivalTime),
  durationMinutes: raw.durationMinutes,
  stops: raw.stops,
  economyAvailable: raw.economyAvailable,
  businessAvailable: raw.businessAvailable,
  firstAvailable: raw.firstAvailable,
  economyPrice: {
    amount: raw.economyPrice.amount,
    currency: raw.economyPrice.currency,
  },
  businessPrice: {
    amount: raw.businessPrice.amount,
    currency: raw.businessPrice.currency,
  },
  firstPrice: {
    amount: raw.firstPrice.amount,
    currency: raw.firstPrice.currency,
  },
  lastUpdated: ensureISO(raw.lastUpdated),
});

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useFlightStream = () => {
  const [state, setState] = useState<FlightStreamState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback((params: SearchParams) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ flights: [], isLoading: true, error: null, isComplete: false });

    const cabin =
      params.cabinClass._tag === "Some" ? params.cabinClass.value : "ECONOMY";

    const program = findAvailableFlights({
      cabin,
      minSeats: params.passengerCount,
      departureDate: params.departureDate,
      origin: params.origin,
      destination: params.destination,
    }).pipe(
      Effect.map((results) => results.map(toFlightResult)),
      Effect.provide(FetchHttpClient.layer),
    );

    Effect.runPromise(program)
      .then((flights) => {
        if (controller.signal.aborted) return;
        setState({ flights, isLoading: false, error: null, isComplete: true });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            err && typeof err === "object" && "message" in err
              ? String(err.message)
              : "An error occurred while searching.",
          isComplete: true,
        }));
      });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { ...state, search } as const;
};
