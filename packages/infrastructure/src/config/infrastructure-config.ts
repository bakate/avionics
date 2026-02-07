import { Config, ConfigError, Either, Redacted } from "effect";
import { secret } from "../config.js";

/**
 * Database configuration
 */
export const DatabaseConfig = Config.all({
  host: Config.string("DB_HOST"),
  port: Config.number("DB_PORT").pipe(Config.withDefault(5432)),
  database: Config.string("DB_NAME").pipe(Config.withDefault("avionics")),
  user: Config.string("DB_USER").pipe(Config.withDefault("postgres")),
  password: Config.redacted("DB_PASSWORD"),
  poolMin: Config.number("DB_POOL_MIN").pipe(Config.withDefault(2)),
  poolMax: Config.number("DB_POOL_MAX").pipe(Config.withDefault(10)),
  url: Config.string("DATABASE_URL").pipe(Config.option),
});

export type DatabaseConfig = Config.Config.Success<typeof DatabaseConfig>;

/**
 * Currency API configuration
 */
export const CurrencyConfig = Config.all({
  apiKey: secret("CURRENCY_API_KEY", "curr_test_mock"),
  cacheTTL: Config.number("CURRENCY_CACHE_TTL").pipe(Config.withDefault(3600)), // 1 hour in seconds
  rateLimitPerMinute: Config.number("CURRENCY_RATE_LIMIT").pipe(
    Config.withDefault(10),
  ),
  baseUrl: Config.string("CURRENCY_BASE_URL").pipe(
    Config.withDefault("https://api.exchangerate-api.com/v4/latest"),
  ),
});

export type CurrencyConfig = Config.Config.Success<typeof CurrencyConfig>;

/**
 * Polar payment gateway configuration
 */
export const PolarConfig = Config.all({
  apiKey: secret("POLAR_API_KEY", "polar_test_mock"),
  productId: Config.string("POLAR_PRODUCT_ID").pipe(
    Config.withDefault("polar_product_test"), // Safe default for dev/test
    Config.mapOrFail((id) => {
      if (
        process.env.NODE_ENV === "production" &&
        id === "polar_product_test"
      ) {
        return Either.left(
          ConfigError.InvalidData(
            [],
            "POLAR_PRODUCT_ID cannot be 'polar_product_test' in production",
          ),
        );
      }
      return Either.right(id);
    }),
  ),
  baseUrl: Config.string("POLAR_BASE_URL").pipe(
    Config.withDefault("https://api.polar.sh/v1"),
  ),
  timeout: Config.number("POLAR_TIMEOUT").pipe(Config.withDefault(30)), // seconds
  maxRetries: Config.number("POLAR_MAX_RETRIES").pipe(Config.withDefault(2)),
});

export type PolarConfig = Config.Config.Success<typeof PolarConfig>;

/**
 * Resend notification gateway configuration
 */
export const ResendConfig = Config.all({
  apiKey: secret("RESEND_API_KEY", "resend_test_mock"),
  fromEmail: Config.string("RESEND_FROM_EMAIL").pipe(
    Config.withDefault("noreply@avionics.com"),
  ),
  baseUrl: Config.string("RESEND_BASE_URL").pipe(
    Config.withDefault("https://api.resend.com"),
  ),
  timeout: Config.number("RESEND_TIMEOUT").pipe(Config.withDefault(15)), // seconds
  maxRetries: Config.number("RESEND_MAX_RETRIES").pipe(Config.withDefault(3)),
});

export type ResendConfig = Config.Config.Success<typeof ResendConfig>;

/**
 * Outbox processor configuration
 */
export const OutboxConfig = Config.all({
  pollingInterval: Config.number("OUTBOX_POLLING_INTERVAL").pipe(
    Config.withDefault(5),
  ), // seconds
  batchSize: Config.number("OUTBOX_BATCH_SIZE").pipe(Config.withDefault(100)),
  maxRetries: Config.number("OUTBOX_MAX_RETRIES").pipe(Config.withDefault(3)),
  retryDelays: Config.array(Config.number("OUTBOX_RETRY_DELAYS")).pipe(
    Config.withDefault([1000, 2000, 4000]),
  ), // milliseconds
});

export type OutboxConfig = Config.Config.Success<typeof OutboxConfig>;

/**
 * Health check configuration
 */
export const HealthConfig = Config.all({
  timeout: Config.number("HEALTH_TIMEOUT").pipe(Config.withDefault(5)), // seconds
  cacheTTL: Config.number("HEALTH_CACHE_TTL").pipe(Config.withDefault(10)), // seconds
});

export type HealthConfig = Config.Config.Success<typeof HealthConfig>;

/**
 * Graceful shutdown configuration
 */
export const ShutdownConfig = Config.all({
  gracePeriod: Config.number("SHUTDOWN_GRACE_PERIOD").pipe(
    Config.withDefault(30),
  ), // seconds
});

export type ShutdownConfig = Config.Config.Success<typeof ShutdownConfig>;

/**
 * Full infrastructure configuration
 */
export const InfrastructureConfig = Config.all({
  database: DatabaseConfig,
  currency: CurrencyConfig,
  polar: PolarConfig,
  resend: ResendConfig,
  outbox: OutboxConfig,
  health: HealthConfig,
  shutdown: ShutdownConfig,
});

export type InfrastructureConfig = Config.Config.Success<
  typeof InfrastructureConfig
>;

/**
 * Helper to redact sensitive values in logs
 */
export function redactSensitiveConfig(config: unknown): unknown {
  if (config === null || config === undefined) {
    return config;
  }

  if (Redacted.isRedacted(config)) {
    return "<redacted>";
  }

  if (Array.isArray(config)) {
    return config.map(redactSensitiveConfig);
  }

  if (typeof config === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      // Redact keys that contain sensitive information
      if (
        key.toLowerCase().includes("key") ||
        key.toLowerCase().includes("password") ||
        key.toLowerCase().includes("secret") ||
        key.toLowerCase().includes("token")
      ) {
        result[key] = "<redacted>";
      } else {
        result[key] = redactSensitiveConfig(value);
      }
    }
    return result;
  }

  return config;
}
