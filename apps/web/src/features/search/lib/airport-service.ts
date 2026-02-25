import { Cache, Effect, Schema } from "effect";

export const Airport = Schema.Struct({
  iata: Schema.String,
  icao: Schema.NullOr(Schema.String),
  name: Schema.String,
  nameFr: Schema.String,
  nameEn: Schema.String,
  cityFr: Schema.String,
  cityEn: Schema.String,
  country: Schema.String,
  countryCode: Schema.String,
  aliases: Schema.Array(Schema.String),
  isMetroGroup: Schema.Boolean,
});

export type Airport = Schema.Schema.Type<typeof Airport>;

const AirportData = Schema.Array(Airport);
type AirportData = Schema.Schema.Type<typeof AirportData>;

// Global variable to store the list once fetched
let allAirports: AirportData | null = null;

const fetchAirports = Effect.gen(function* () {
  if (allAirports) return allAirports;

  const response = yield* Effect.promise(() => fetch("/data/airports.json"));
  if (!response.ok) {
    return yield* Effect.fail(new Error("Failed to fetch airports.json"));
  }

  const raw = yield* Effect.promise(() => response.json());
  const data = yield* Schema.decodeUnknown(AirportData)(raw).pipe(
    Effect.catchAll(() =>
      Effect.fail(new Error("Failed to parse airports data")),
    ),
  );

  allAirports = data;
  return data;
});

// Cache key is "locale:query"
const searchCache = Effect.runSync(
  Cache.make({
    capacity: 1000,
    timeToLive: "1 hours",
    lookup: (key: string) =>
      Effect.gen(function* () {
        const [locale, query] = key.split(":");
        if (!locale || !query) return [];

        const list = yield* fetchAirports;
        const lowerQuery = query.toLowerCase();

        return list
          .filter((a) => {
            const searchFields = [
              a.iata,
              a.icao,
              a.nameFr,
              a.nameEn,
              a.cityFr,
              a.cityEn,
              a.country,
              ...(a.aliases ?? []),
            ];

            return searchFields.some((field) =>
              field?.toLowerCase().includes(lowerQuery),
            );
          })
          .slice(0, 20);
      }),
  }),
);

export const searchAirports = (
  query: string,
  locale: string = "fr",
): Effect.Effect<ReadonlyArray<Airport>, Error, never> => {
  if (query.length < 2) return Effect.succeed([]);
  // Normalize locale for cache key
  const normalizedLocale = locale.split("-")[0] || "fr";
  return searchCache.get(`${normalizedLocale}:${query}`);
};
