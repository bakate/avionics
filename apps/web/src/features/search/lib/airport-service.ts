import { Cache, Effect } from "effect";

export interface Airport {
  readonly iata: string;
  readonly icao: string | null;
  readonly name: string;
  readonly nameFr: string;
  readonly nameEn: string;
  readonly cityFr: string;
  readonly cityEn: string;
  readonly country: string;
  readonly countryCode: string;
  readonly aliases: ReadonlyArray<string>;
  readonly isMetroGroup: boolean;
}

type AirportData = ReadonlyArray<Airport>;

// Global variable to store the list once fetched
let allAirports: AirportData | null = null;

const fetchAirports = Effect.gen(function* () {
  if (allAirports) return allAirports;

  const response = yield* Effect.promise(() => fetch("/data/airports.json"));
  if (!response.ok) {
    return yield* Effect.fail(new Error("Failed to fetch airports.json"));
  }

  const data: AirportData = yield* Effect.promise(() => response.json());
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
