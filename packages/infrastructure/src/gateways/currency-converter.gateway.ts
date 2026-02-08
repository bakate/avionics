/**
 * @file currency-converter.gateway.ts
 * @module @workspace/infrastructure/gateways
 * @description Currency conversion gateway implementation using Effect HttpClient.
 *
 * Features:
 * - In-memory cache with configurable TTL (default 1 hour)
 * - Rate limiting (configurable, default 10 requests/minute)
 * - Retry policy with exponential backoff (3 retries, 4 total attempts)
 * - Same-currency identity (no API call)
 */

import { FetchHttpClient, HttpClient, HttpClientError } from "@effect/platform";
import {
  CurrencyApiUnavailableError,
  type CurrencyConversionError,
  CurrencyConverterGateway,
} from "@workspace/application/currency-converter.gateway";
import { CurrencyMismatchError } from "@workspace/domain/errors";
import {
  type CurrencyCode,
  Money,
  SupportedCurrencies,
} from "@workspace/domain/kernel";
import {
  Cache,
  Duration,
  Effect,
  Layer,
  RateLimiter,
  Redacted,
  Schedule,
  Schema,
} from "effect";
import { CurrencyConfig } from "../config/infrastructure-config.js";

// ============================================================================
// Types & Schemas
// ============================================================================

/**
 * Exchange rate API response schema
 * Using exchangerate-api.com format
 */
const ExchangeRateResponseSchema = Schema.Struct({
  base: Schema.String,
  date: Schema.String,
  rates: Schema.Record({ key: Schema.String, value: Schema.Number }),
});

type ExchangeRateResponse = Schema.Schema.Type<
  typeof ExchangeRateResponseSchema
>;

/**
 * Cache key for exchange rates
 */
type CacheKey = `rates:${CurrencyCode}`;

// Note: Using SupportedCurrencies from domain for validation

// ============================================================================
// Error Mappers
// ============================================================================

const mapHttpErrorToConversionError = (
  error: HttpClientError.HttpClientError,
): CurrencyConversionError => {
  if (error._tag === "RequestError") {
    return new CurrencyApiUnavailableError({
      message: `Currency API request failed: ${error.reason}`,
      cause: error,
    });
  }

  // ResponseError - API returned an error status
  return new CurrencyApiUnavailableError({
    message: `Currency API responded with HTTP ${error.response.status}`,
    cause: error,
  });
};

// ============================================================================
// Helpers
// ============================================================================
/**
 * Validates currency code against domain-defined currencies
 */
export const isValidCurrency = (code: string): code is CurrencyCode =>
  SupportedCurrencies.includes(code as (typeof SupportedCurrencies)[number]);

// ============================================================================
// Implementation
// ============================================================================

/**
 * Creates the CurrencyConverterGateway layer with caching and rate limiting.
 */
export class HttpCurrencyConverterGateway {
  /**
   * Live Layer — Implementation with caching, rate limiting, and retries.
   */
  static readonly Live = Layer.scoped(
    CurrencyConverterGateway,
    Effect.gen(function* () {
      const config = yield* CurrencyConfig;
      const httpClient = yield* HttpClient.HttpClient;

      // Create rate limiter: N requests per minute
      const rateLimit = yield* RateLimiter.make({
        limit: config.rateLimitPerMinute,
        interval: Duration.minutes(1),
      });

      // Retry policy: 3 retries (4 total attempts) with exponential backoff
      const retryPolicy = Schedule.exponential(Duration.millis(500)).pipe(
        Schedule.intersect(Schedule.recurs(3)),
      );

      // Helper: fetch rates from API with rate limiting and retries
      const fetchRates = (baseCurrency: CurrencyCode) =>
        rateLimit(
          Effect.gen(function* () {
            // Build request URL
            const url = `${config.baseUrl}/${baseCurrency}`;

            // Make HTTP request
            const response = yield* httpClient.get(url, {
              headers: {
                Authorization: `Bearer ${Redacted.value(config.apiKey)}`,
              },
            });

            // Check for success status
            if (response.status >= 400) {
              return yield* Effect.fail(
                new CurrencyApiUnavailableError({
                  message: `Currency API responded with HTTP ${response.status}`,
                }),
              );
            }

            // Parse response body
            const body = yield* response.json;
            const parsed = yield* Schema.decodeUnknown(
              ExchangeRateResponseSchema,
            )(body).pipe(
              Effect.mapError(
                () =>
                  new CurrencyApiUnavailableError({
                    message: "Failed to parse currency API response",
                  }),
              ),
            );

            return parsed;
          }).pipe(
            Effect.retry(retryPolicy),
            Effect.timeout(Duration.seconds(10)),
            Effect.catchTag("TimeoutException", () =>
              Effect.fail(
                new CurrencyApiUnavailableError({
                  message: "Currency API request timed out after 10 seconds",
                }),
              ),
            ),
            Effect.catchAll(
              (error): Effect.Effect<never, CurrencyConversionError> => {
                // Already a conversion error, pass through
                if (
                  error instanceof CurrencyMismatchError ||
                  error instanceof CurrencyApiUnavailableError
                ) {
                  return Effect.fail(error);
                }
                // Map HttpClient errors
                if (HttpClientError.isHttpClientError(error)) {
                  return Effect.fail(mapHttpErrorToConversionError(error));
                }
                // Fallback for unknown errors
                return Effect.fail(
                  new CurrencyApiUnavailableError({
                    message: `Currency API error: ${String(error)}`,
                  }),
                );
              },
            ),
          ),
        );

      // Create cache for exchange rates with configurable TTL
      const ratesCache = yield* Cache.make<
        CacheKey,
        ExchangeRateResponse,
        CurrencyConversionError
      >({
        capacity: 50,
        timeToLive: Duration.seconds(config.cacheTTL),
        lookup: (key) => {
          const baseCurrency = key.replace("rates:", "") as CurrencyCode;
          return fetchRates(baseCurrency);
        },
      });

      // ========================================================================
      // Service Implementation
      // ========================================================================

      const convert = (money: Money, toCurrency: CurrencyCode) =>
        Effect.gen(function* () {
          const fromCurrency = money.currency;

          // Same-currency identity: return original without API call
          if (fromCurrency === toCurrency) {
            return money;
          }

          // Validate currencies
          if (!isValidCurrency(fromCurrency)) {
            return yield* Effect.fail(
              new CurrencyMismatchError({
                expected: SupportedCurrencies.join(", "),
                actual: fromCurrency,
              }),
            );
          }

          if (!isValidCurrency(toCurrency)) {
            return yield* Effect.fail(
              new CurrencyMismatchError({
                expected: SupportedCurrencies.join(", "),
                actual: toCurrency,
              }),
            );
          }

          // Get exchange rates from cache (or fetch if not cached)
          const cacheKey: CacheKey = `rates:${fromCurrency}`;
          const ratesResponse = yield* ratesCache.get(cacheKey);

          // Find the target currency rate
          const rate = ratesResponse.rates[toCurrency];
          if (rate === undefined) {
            return yield* Effect.fail(
              new CurrencyMismatchError({
                expected: toCurrency,
                actual: `Rate not found for ${toCurrency}`,
              }),
            );
          }

          // Calculate converted amount
          const convertedAmount = Math.round(money.amount * rate * 100) / 100;
          return Money.of(convertedAmount, toCurrency);
        });

      return { convert };
    }),
  ).pipe(Layer.provide(FetchHttpClient.layer));

  /**
   * Test Layer — Mock implementation.
   */
  static readonly Test = (overrides: Partial<CurrencyConverterGateway> = {}) =>
    Layer.succeed(
      CurrencyConverterGateway,
      CurrencyConverterGateway.of({
        convert: (money, toCurrency) =>
          Effect.succeed(Money.of(money.amount, toCurrency)),
        ...overrides,
      }),
    );
}
