import { FetchHttpClient, HttpApiClient } from "@effect/platform";
import { Api } from "@workspace/api/api";
import {
  Config,
  Context,
  Effect,
  Layer,
  ManagedRuntime,
  Request,
} from "effect";

/**
 *
 * Global API Client Configuration
 */
const getBaseUrl = () => {
  if (import.meta.env?.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return "http://localhost:3000";
};

export const ApiUrl = Config.succeed(getBaseUrl());

/**
 * Internal effect to create the client, used for type inference
 */
const makeClientEffect = Effect.flatMap(ApiUrl, (baseUrl) =>
  HttpApiClient.make(Api, { baseUrl }),
);

/**
 * Type-safe API Client instance
 */
export type Client = Effect.Effect.Success<typeof makeClientEffect>;

export class ApiClient extends Context.Tag("ApiClient")<ApiClient, Client>() {}

/**
 * Global Request Cache for API calls (Deduplication & TTL)
 */
const apiRequestCache = Effect.runSync(
  Request.makeCache({ capacity: 500, timeToLive: "2 minutes" }),
);

export const ClientLive = Layer.effect(ApiClient, makeClientEffect).pipe(
  Layer.provide(FetchHttpClient.layer),
  // Inject the global request cache into the environment
  Layer.provideMerge(Layer.setRequestCache(apiRequestCache)),
);

export const ApiRuntime = ManagedRuntime.make(ClientLive);

/**
 * Compatibility helper: Returns the API Client as an Effect.
 * It uses the global runtime to ensure the client is correctly initialized.
 */
export const makeClient: Effect.Effect<Client, never, never> =
  Effect.tryPromise(() => ApiRuntime.runPromise(ApiClient)).pipe(Effect.orDie);

/**
 * Helper to run a program that requires the ApiClient using the global runtime.
 */
export const runPromise = <A, E>(
  program: Effect.Effect<A, E, ApiClient>,
): Promise<A> => ApiRuntime.runPromise(program);
