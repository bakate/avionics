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
import { Effect } from "effect";
import { useCallback, useEffect, useRef, useState } from "react";
import { findAvailableFlights } from "../api/inventory.api.ts";
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

/**
 * Convert an API FlightAvailability response to the lightweight FlightResult
 * stored in the booking machine context.
 */
const toFlightResult = (raw: {
  flightId: string;
  economyAvailable: number;
  businessAvailable: number;
  firstAvailable: number;
  economyPrice: { amount: number; currency: string };
  businessPrice: { amount: number; currency: string };
  firstPrice: { amount: number; currency: string };
  lastUpdated: Date | string;
}): FlightResult => ({
  flightId: raw.flightId,
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
  lastUpdated:
    typeof raw.lastUpdated === "string"
      ? raw.lastUpdated
      : raw.lastUpdated.toISOString(),
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
            err instanceof Error
              ? err.message
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
