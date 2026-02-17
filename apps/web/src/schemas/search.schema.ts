import { AirportCodeSchema, CabinClassSchema } from "@workspace/domain/kernel";
import { Schema } from "effect";

const AirportCodeTransform = Schema.String.pipe(
  Schema.transform(Schema.String, {
    decode: (s) => s.toUpperCase(),
    encode: (s) => s,
  }),
  Schema.compose(AirportCodeSchema),
);

export const SearchParams = Schema.Struct({
  origin: AirportCodeTransform,
  destination: AirportCodeTransform,
  departureDate: Schema.DateFromString,
  returnDate: Schema.optionalWith(Schema.DateFromString, { as: "Option" }),
  passengerCount: Schema.NumberFromString.pipe(
    Schema.int(),
    Schema.between(1, 9),
  ),
  cabinClass: Schema.optionalWith(CabinClassSchema, { as: "Option" }),
});

export type SearchParams = typeof SearchParams.Type;
export type SearchParamsEncoded = typeof SearchParams.Encoded;

export const decodeSearchParams = Schema.decodeUnknownSync(SearchParams);
export const encodeSearchParams = Schema.encodeSync(SearchParams);
