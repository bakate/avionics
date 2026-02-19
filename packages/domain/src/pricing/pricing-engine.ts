/**
 * @file pricing-engine.ts
 * @module @workspace/domain/pricing
 * @description Pure pricing engine for multi-passenger fare computation.
 * No side effects, no dependencies beyond `effect` and kernel value objects.
 */

import { Schema } from "effect";
import { Money, type PassengerType, PassengerTypeSchema } from "../kernel.js";

// =============================================================================
// MULTIPLIER MAP — Single source of truth
// =============================================================================

export const PASSENGER_MULTIPLIERS: Record<PassengerType, number> = {
  INFANT: 0.0,
  CHILD: 0.75,
  YOUNG_ADULT: 0.9,
  ADULT: 1.0,
  SENIOR: 0.95,
} as const;

// =============================================================================
// VALUE OBJECTS
// =============================================================================

export class PassengerFare extends Schema.Class<PassengerFare>("PassengerFare")(
  {
    passengerId: Schema.String,
    passengerType: PassengerTypeSchema,
    basePrice: Money,
    multiplier: Schema.Number,
    finalPrice: Money,
  },
) {}

export class PricingBreakdown extends Schema.Class<PricingBreakdown>(
  "PricingBreakdown",
)({
  fares: Schema.Array(PassengerFare),
  totalPrice: Money,
}) {}

export const getMultiplier = (type: PassengerType): number =>
  PASSENGER_MULTIPLIERS[type];

export const computePassengerFare = (
  passengerId: string,
  type: PassengerType,
  basePrice: Money,
): PassengerFare => {
  const multiplier = getMultiplier(type);
  const finalPrice = basePrice.multiply(multiplier);
  return new PassengerFare({
    passengerId,
    passengerType: type,
    basePrice,
    multiplier,
    finalPrice,
  });
};

export const computePricingBreakdown = (
  passengers: ReadonlyArray<{ id: string; type: PassengerType }>,
  basePrice: Money,
): PricingBreakdown => {
  const fares = passengers.map((p) =>
    computePassengerFare(p.id, p.type, basePrice),
  );
  const totalPrice = fares.reduce(
    (sum, fare) => sum.add(fare.finalPrice),
    Money.zero(basePrice.currency),
  );
  return new PricingBreakdown({ fares, totalPrice });
};

export const countSeatsNeeded = (
  passengers: ReadonlyArray<{ type: PassengerType }>,
): number => passengers.filter((p) => p.type !== "INFANT").length;
