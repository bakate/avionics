import { HttpApiClient } from "@effect/platform";
import { Api } from "@workspace/api/api";
import { Config, Effect } from "effect";

/**
 * API Client Configuration
 */
export const ApiUrl = Config.string("API_URL").pipe(
  Config.withDefault("http://localhost:3000"),
);

/**
 * Create the API Client
 */
export const makeClient = Effect.flatMap(ApiUrl, (baseUrl) =>
  HttpApiClient.make(Api, { baseUrl }),
);

/**
 * Type-safe API Client instance
 */
export type Client = Effect.Effect.Success<typeof makeClient>;
