/**
 * @file inventory-queries.ts
 * @module @workspace/application/queries
 * @description Query service for inventory read models (CQRS read side)
 */

import { type FlightNotFoundError } from "@workspace/domain/errors";
import { type FlightId } from "@workspace/domain/kernel";
import { Context, type Effect } from "effect";
import {
  type CabinAvailability,
  type FlightAvailability,
} from "../models/read-models.js";

/**
 * Query service for inventory read operations
 * Optimized for read performance, separate from command side
 */
export interface InventoryQueriesPort {
  /**
   * Get flight availability summary (all cabins)
   */
  getFlightAvailability(
    flightId: FlightId,
  ): Effect.Effect<FlightAvailability, FlightNotFoundError>;

  /**
   * Get specific cabin availability
   */
  getCabinAvailability(
    flightId: FlightId,
    cabin: string,
  ): Effect.Effect<CabinAvailability, FlightNotFoundError>;

  /**
   * Find flights with available seats
   */
  findAvailableFlights(params: {
    cabin: string;
    minSeats: number;
    departureDate?: Date;
    route?: { origin: string; destination: string };
  }): Effect.Effect<ReadonlyArray<FlightAvailability>>;

  /**
   * Get low inventory alerts (flights with < threshold seats)
   */
  getLowInventoryAlerts(
    threshold: number,
  ): Effect.Effect<ReadonlyArray<FlightAvailability>>;

  /**
   * Get inventory statistics
   */
  getInventoryStats(): Effect.Effect<{
    totalFlights: number;
    totalSeatsAvailable: number;
    averageUtilization: number;
    fullFlights: number;
  }>;
}

export class InventoryQueries extends Context.Tag("InventoryQueries")<
  InventoryQueries,
  InventoryQueriesPort
>() {}
