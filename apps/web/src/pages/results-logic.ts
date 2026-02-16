import { type CabinClass } from "@workspace/domain/kernel";
import { type FilterState } from "../components/flights/filter-panel";
import {
  type SortField,
  type SortOrder,
} from "../components/flights/sort-controls";
import { type FlightResult } from "../machines/booking.machine";

/**
 * Pure functions for flight sorting and filtering.
 * Extracted for testability (Property-based testing).
 */

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
    if (cabin === "ECONOMY" && flight.economyAvailable <= 0) return false;
    if (cabin === "BUSINESS" && flight.businessAvailable <= 0) return false;
    if (cabin === "FIRST" && flight.firstAvailable <= 0) return false;

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

    const getPrice = (f: FlightResult) => {
      if (cabinClass === "BUSINESS") return f.businessPrice.amount;
      if (cabinClass === "FIRST") return f.firstPrice.amount;
      return f.economyPrice.amount;
    };

    switch (field) {
      case "price":
        valA = getPrice(a);
        valB = getPrice(b);
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
