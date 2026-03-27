import { Schema } from "effect";

export const FilterState = Schema.Struct({
  cabinClass: Schema.String,
  maxStops: Schema.NullOr(Schema.Number),
  timeRange: Schema.NullOr(Schema.Tuple(Schema.Number, Schema.Number)), // [minHour, maxHour]
});
export type FilterState = typeof FilterState.Type;

export const SortField = Schema.Literal("price", "departure", "duration");
export type SortField = typeof SortField.Type;

export const SortOrder = Schema.Literal("asc", "desc");
export type SortOrder = typeof SortOrder.Type;
