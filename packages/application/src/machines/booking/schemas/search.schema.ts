import { AirportCodeSchema, CabinClassSchema } from "@workspace/domain/kernel";
import { Schema } from "effect";

const AirportCodeTransform = Schema.String.pipe(
  Schema.transform(Schema.String, {
    decode: (s) => s.toUpperCase(),
    encode: (s) => s,
  }),
  Schema.compose(AirportCodeSchema),
);

export const Passengers = Schema.Struct({
  adults: Schema.Number.pipe(Schema.int(), Schema.between(1, 9)),
  children: Schema.Number.pipe(Schema.int(), Schema.between(0, 8)),
  infants: Schema.Number.pipe(Schema.int(), Schema.between(0, 4)),
});

export type Passengers = typeof Passengers.Type;

export const SearchParams = Schema.Struct({
  tripType: Schema.Literal("roundTrip", "oneWay"),
  origin: AirportCodeTransform,
  destination: AirportCodeTransform,
  departureDate: Schema.String.pipe(Schema.trimmed(), Schema.minLength(1)),
  returnDate: Schema.optional(
    Schema.String.pipe(Schema.trimmed(), Schema.minLength(1)),
  ),
  passengers: Passengers,
  cabinClass: Schema.optional(CabinClassSchema),
}).pipe(
  Schema.filter((params) => {
    if (params.tripType === "roundTrip" && !params.returnDate) {
      return {
        path: ["returnDate"],
        message: "Return date is required for round-trip",
      };
    }
    return undefined;
  }),
);

export type SearchParams = typeof SearchParams.Type;
export type SearchParamsEncoded = typeof SearchParams.Encoded;

export const decodeSearchParams = Schema.decodeUnknownSync(SearchParams);
export const encodeSearchParams = Schema.encodeSync(SearchParams);
