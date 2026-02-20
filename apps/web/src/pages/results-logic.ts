import { type CabinClass } from "@workspace/domain/kernel";
import { type FilterState } from "../components/flights/filter-panel";
import {
  type SortField,
  type SortOrder,
} from "../components/flights/sort-controls";
import { type FlightResult } from "../features/booking/machines/booking.machine";

/**
 * Pure functions for flight sorting and filtering.
 * Extracted for testability (Property-based testing).
 */

/** Get price for a specific cabin from the cabins array */
const getCabinPrice = (
  flight: FlightResult,
  cabin: CabinClass,
): { amount: number; currency: string } => {
  const cabinData = flight.cabins.find((c) => c.cabin === cabin);
  return cabinData?.price ?? { amount: 0, currency: "EUR" };
};

/** Get available seats for a specific cabin */
const getCabinAvailability = (
  flight: FlightResult,
  cabin: CabinClass,
): number => {
  const cabinData = flight.cabins.find((c) => c.cabin === cabin);
  return cabinData?.availableSeats ?? 0;
};

/**
 * Apply filtering logic to a list of flights.
 */
export const filterFlights = (
  flights: ReadonlyArray<FlightResult>,
  filters: FilterState,
): ReadonlyArray<FlightResult> => {
  return flights.filter((flight) => {
    // Filter by max stops
    if (filters.maxStops !== null && flight.stops > filters.maxStops) {
      return false;
    }

    // Filter by departure time range
    if (filters.timeRange) {
      const departureHour = new Date(flight.departureTime).getHours();
      const [min, max] = filters.timeRange;
      if (departureHour < min || departureHour >= max) {
        return false;
      }
    }

    // Filter by availability in selected cabin class
    const cabin = filters.cabinClass as CabinClass;
    if (getCabinAvailability(flight, cabin) <= 0) return false;

    return true;
  });
};

/**
 * Apply sorting logic to a list of flights.
 */
export const sortFlights = (
  flights: ReadonlyArray<FlightResult>,
  field: SortField,
  order: SortOrder,
  cabinClass: CabinClass,
): ReadonlyArray<FlightResult> => {
  const result = [...flights];

  result.sort((a, b) => {
    let valA: number;
    let valB: number;

    switch (field) {
      case "price":
        valA = getCabinPrice(a, cabinClass).amount;
        valB = getCabinPrice(b, cabinClass).amount;
        break;
      case "departure":
        valA = new Date(a.departureTime).getTime();
        valB = new Date(b.departureTime).getTime();
        break;
      case "duration":
        valA = a.durationMinutes;
        valB = b.durationMinutes;
        break;
      default:
        valA = 0;
        valB = 0;
    }

    if (valA === valB) return 0;
    return order === "asc" ? valA - valB : valB - valA;
  });

  return result;
};
