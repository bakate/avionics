import { AirportCodeSchema, CabinClassSchema } from "@workspace/domain/kernel";
import { Schema } from "effect";

export const SearchParams = Schema.Struct({
  origin: AirportCodeSchema,
  destination: AirportCodeSchema,
  departureDate: Schema.Date,
  returnDate: Schema.optionalWith(Schema.Date, { as: "Option" }),
  passengerCount: Schema.Number.pipe(Schema.int(), Schema.between(1, 9)),
  cabinClass: Schema.optionalWith(CabinClassSchema, { as: "Option" }),
});

export type SearchParams = typeof SearchParams.Type;
export type SearchParamsEncoded = typeof SearchParams.Encoded;

export const decodeSearchParams = Schema.decodeUnknownSync(SearchParams);
export const encodeSearchParams = Schema.encodeSync(SearchParams);
