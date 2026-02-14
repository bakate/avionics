import { AirportCodeSchema } from "@workspace/domain/kernel";
import { Schema } from "effect";

export const CabinClass = Schema.Literal(
  "economy",
  "premium",
  "business",
  "first",
);
export type CabinClass = Schema.Schema.Type<typeof CabinClass>;

export const SearchParams = Schema.Struct({
  origin: AirportCodeSchema,
  destination: AirportCodeSchema,
  departureDate: Schema.String,
  returnDate: Schema.optional(Schema.String),
  passengers: Schema.Number,
  cabinClass: Schema.optional(CabinClass),
});

export type SearchParams = Schema.Schema.Type<typeof SearchParams>;
