import { Config, ConfigError, Either, Redacted, Schema } from "effect";

// ============================================================================
// Helpers
// ============================================================================

const isDevOrTest =
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

/**
 * Creates a redacted configuration value with a fallback for development/test.
 */
export const secret = (name: string, mock?: string) => {
  const config = Config.redacted(name);
  if (isDevOrTest && mock) {
    return config.pipe(Config.withDefault(Redacted.make(mock)));
  }
  return config;
};

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
    for (const [key, value] of Object.entries(
      config as Record<string, unknown>,
    )) {
      const lowerKey = key.toLowerCase();
      const sensitivePatterns = [
        "password",
        "secret",
        "token",
        "apikey",
        "api_key",
        "key",
        "privatekey",
        "accesskey",
        "signingkey",
        "encryptionkey",
      ];
      if (sensitivePatterns.some((p) => lowerKey.includes(p))) {
        result[key] = "<redacted>";
      } else {
        result[key] = redactSensitiveConfig(value);
      }
    }
    return result;
  }

  return config;
}

// ============================================================================
// Shared Configs
// ============================================================================

const nodeEnv = Config.string("NODE_ENV").pipe(
  Config.withDefault("development"),
);

// ============================================================================
// Database Config
// ============================================================================

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

// ============================================================================
// Gateway Configs
// ============================================================================

export const CurrencyConfig = Config.all({
  apiKey: secret("CURRENCY_API_KEY", "curr_test_mock"),
  cacheTTL: Config.number("CURRENCY_CACHE_TTL").pipe(Config.withDefault(3600)),
  rateLimitPerMinute: Config.number("CURRENCY_RATE_LIMIT").pipe(
    Config.withDefault(10),
  ),
  baseUrl: Config.string("CURRENCY_BASE_URL").pipe(
    Config.withDefault("https://api.exchangerate-api.com/v4/latest"),
  ),
});

export type CurrencyConfig = Config.Config.Success<typeof CurrencyConfig>;

export const PolarConfig = Config.all({
  apiKey: secret("POLAR_API_KEY", "polar_test_mock"),
  productId: Config.string("POLAR_PRODUCT_ID").pipe(
    Config.withDefault("polar_product_test"),
    Config.mapOrFail((id) => {
      const allowSandbox = process.env.POLAR_ALLOW_SANDBOX === "true";
      if (
        process.env.NODE_ENV === "production" &&
        id === "polar_product_test" &&
        !allowSandbox
      ) {
        return Either.left(
          ConfigError.InvalidData(
            [],
            "POLAR_PRODUCT_ID cannot be 'polar_product_test' in production (unless POLAR_ALLOW_SANDBOX=true)",
          ),
        );
      }
      return Either.right(id);
    }),
  ),
  baseUrl: Config.string("POLAR_BASE_URL").pipe(
    Config.withDefault("https://sandbox-api.polar.sh"),
  ),
  timeout: Config.number("POLAR_TIMEOUT").pipe(Config.withDefault(30)),
  maxRetries: Config.number("POLAR_MAX_RETRIES").pipe(Config.withDefault(2)),
}).pipe(
  Config.mapOrFail((config) => {
    const PolarSandboxSchema = Schema.String.pipe(
      Schema.pattern(/^https:\/\/sandbox(-api)?\.polar\.sh(:\d+)?(\/.*)?$/),
    );
    const isSandbox = Schema.is(PolarSandboxSchema)(config.baseUrl);
    const allowSandbox = process.env.POLAR_ALLOW_SANDBOX === "true";

    if (process.env.NODE_ENV === "production" && isSandbox && !allowSandbox) {
      return Either.left(
        ConfigError.InvalidData(
          [],
          "POLAR_BASE_URL cannot be a sandbox URL in production (unless POLAR_ALLOW_SANDBOX=true)",
        ),
      );
    }
    return Either.right({ ...config, isSandbox });
  }),
);

export type PolarConfig = Config.Config.Success<typeof PolarConfig>;

export const ResendConfig = Config.all({
  apiKey: secret("RESEND_API_KEY", "resend_test_mock"),
  fromEmail: Config.string("RESEND_FROM_EMAIL").pipe(
    Config.withDefault("noreply@avionics.com"),
  ),
  baseUrl: Config.string("RESEND_BASE_URL").pipe(
    Config.withDefault("https://api.resend.com"),
  ),
  timeout: Config.number("RESEND_TIMEOUT").pipe(Config.withDefault(15)),
  maxRetries: Config.number("RESEND_MAX_RETRIES").pipe(Config.withDefault(3)),
});

export type ResendConfig = Config.Config.Success<typeof ResendConfig>;

// ============================================================================
// Internal Service Configs
// ============================================================================

export const OutboxConfig = Config.all({
  pollingInterval: Config.number("OUTBOX_POLLING_INTERVAL").pipe(
    Config.withDefault(5),
  ),
  batchSize: Config.number("OUTBOX_BATCH_SIZE").pipe(Config.withDefault(100)),
  maxRetries: Config.number("OUTBOX_MAX_RETRIES").pipe(Config.withDefault(3)),
  retryDelays: Config.array(Config.number("OUTBOX_RETRY_DELAYS")).pipe(
    Config.withDefault([1000, 2000, 4000]),
  ),
});

export type OutboxConfig = Config.Config.Success<typeof OutboxConfig>;

export const HealthConfig = Config.all({
  timeout: Config.number("HEALTH_TIMEOUT").pipe(Config.withDefault(5)),
  cacheTTL: Config.number("HEALTH_CACHE_TTL").pipe(Config.withDefault(10)),
});

export type HealthConfig = Config.Config.Success<typeof HealthConfig>;

export const ShutdownConfig = Config.all({
  gracePeriod: Config.number("SHUTDOWN_GRACE_PERIOD").pipe(
    Config.withDefault(30),
  ),
});

export type ShutdownConfig = Config.Config.Success<typeof ShutdownConfig>;

// ============================================================================
// API Config
// ============================================================================

export const ApiConfig = Config.all({
  port: Config.number("PORT").pipe(Config.withDefault(3000)),
  corsOrigins: Config.all([
    nodeEnv,
    Config.array(Config.string()).pipe(
      Config.withDefault([] as Array<string>),
      Config.nested("CORS_ORIGINS"),
    ),
  ]).pipe(
    Config.mapOrFail(([env, origins]) => {
      if (env !== "development" && origins.length === 0) {
        return Either.left(
          ConfigError.InvalidData(
            [],
            "CORS_ORIGINS must be explicitly set in non-development environments",
          ),
        );
      }
      return Either.right(origins);
    }),
  ),
  nodeEnv,
  polarWebhookSecret: Config.string("POLAR_WEBHOOK_SECRET").pipe(
    Config.redacted,
  ),
});

export type ApiConfig = Config.Config.Success<typeof ApiConfig>;

// ============================================================================
// Combined Configs
// ============================================================================

/**
 * Full infrastructure configuration (compat with @workspace/infrastructure)
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
 * Full application configuration (API + Infrastructure)
 */
export const AppConfig = Config.all({
  api: ApiConfig,
  infrastructure: InfrastructureConfig,
});

export type AppConfig = Config.Config.Success<typeof AppConfig>;
