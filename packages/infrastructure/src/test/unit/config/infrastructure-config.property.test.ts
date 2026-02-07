import { fc, test } from "@fast-check/vitest";
import { ConfigProvider, Effect, Redacted } from "effect";
import { describe, expect } from "vitest";
import {
  type InfrastructureConfig,
  InfrastructureConfig as InfrastructureConfigEffect,
  redactSensitiveConfig,
} from "../../../config/infrastructure-config.js";

// ============================================================================
// Types
// ============================================================================

type OptionalConfigKey = (typeof OPTIONAL_CONFIG_KEYS)[number];

type ConfigValueGetter = (config: InfrastructureConfig) => number | string;

// ============================================================================
// Test Helpers
// ============================================================================

const REQUIRED_CONFIG_KEYS = [
  "DB_HOST",
  "DB_PASSWORD",
  // API Keys have defaults in test/dev environment via secret() helper
] as const;

const OPTIONAL_CONFIG_KEYS = [
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_POOL_MIN",
  "DB_POOL_MAX",
  "CURRENCY_CACHE_TTL",
  "CURRENCY_RATE_LIMIT",
  "POLAR_TIMEOUT",
  "RESEND_TIMEOUT",
  "OUTBOX_POLLING_INTERVAL",
  "OUTBOX_BATCH_SIZE",
  "HEALTH_TIMEOUT",
  "SHUTDOWN_GRACE_PERIOD",
] as const;

const DEFAULT_VALUES: Record<OptionalConfigKey, number | string> = {
  DB_PORT: 5432,
  DB_NAME: "avionics",
  DB_USER: "postgres",
  DB_POOL_MIN: 2,
  DB_POOL_MAX: 10,
  CURRENCY_CACHE_TTL: 3600,
  CURRENCY_RATE_LIMIT: 10,
  POLAR_TIMEOUT: 30,
  RESEND_TIMEOUT: 15,
  OUTBOX_POLLING_INTERVAL: 5,
  OUTBOX_BATCH_SIZE: 100,
  HEALTH_TIMEOUT: 5,
  SHUTDOWN_GRACE_PERIOD: 30,
};

const CONFIG_KEY_TO_PATH: Record<OptionalConfigKey, ConfigValueGetter> = {
  DB_PORT: (c) => c.database.port,
  DB_NAME: (c) => c.database.database,
  DB_USER: (c) => c.database.user,
  DB_POOL_MIN: (c) => c.database.poolMin,
  DB_POOL_MAX: (c) => c.database.poolMax,
  CURRENCY_CACHE_TTL: (c) => c.currency.cacheTTL,
  CURRENCY_RATE_LIMIT: (c) => c.currency.rateLimitPerMinute,
  POLAR_TIMEOUT: (c) => c.polar.timeout,
  RESEND_TIMEOUT: (c) => c.resend.timeout,
  OUTBOX_POLLING_INTERVAL: (c) => c.outbox.pollingInterval,
  OUTBOX_BATCH_SIZE: (c) => c.outbox.batchSize,
  HEALTH_TIMEOUT: (c) => c.health.timeout,
  SHUTDOWN_GRACE_PERIOD: (c) => c.shutdown.gracePeriod,
};

function createMinimalConfig(): Map<string, string> {
  return new Map([
    ["DB_HOST", "localhost"],
    ["DB_PASSWORD", "secret"],
    ["CURRENCY_API_KEY", "currency_key"],
    ["POLAR_API_KEY", "polar_key"],
    ["RESEND_API_KEY", "resend_key"],
  ]);
}

function loadConfigWithProvider(provider: ConfigProvider.ConfigProvider) {
  const program = InfrastructureConfigEffect.pipe(
    Effect.withConfigProvider(provider),
  );
  return Effect.runSyncExit(program);
}

function getConfigValue(
  config: InfrastructureConfig,
  key: OptionalConfigKey,
): number | string {
  const getter = CONFIG_KEY_TO_PATH[key];
  return getter(config);
}

// ============================================================================
// Property Tests
// ============================================================================

describe("Configuration Property Tests", () => {
  /**
   * Property 21: Missing required config fails fast
   * Feature: infrastructure-layer, Property 21: Missing required config fails fast
   */
  test.prop([fc.constantFrom(...REQUIRED_CONFIG_KEYS)], { numRuns: 30 })(
    "Property 21: Missing required config fails fast",
    (missingKey) => {
      const configMap = createMinimalConfig();
      configMap.delete(missingKey);

      const incompleteProvider = ConfigProvider.fromMap(configMap);
      const result = loadConfigWithProvider(incompleteProvider);

      expect(result._tag).toBe("Failure");
    },
  );

  /**
   * Property 22: Optional config uses defaults
   * Feature: infrastructure-layer, Property 22: Optional config uses defaults
   */
  test.prop([fc.constantFrom(...OPTIONAL_CONFIG_KEYS)], { numRuns: 30 })(
    "Property 22: Optional config uses defaults",
    (optionalKey) => {
      const configProvider = ConfigProvider.fromMap(createMinimalConfig());
      const result = loadConfigWithProvider(configProvider);

      expect(result._tag).toBe("Success");

      if (result._tag === "Success") {
        const actualValue = getConfigValue(result.value, optionalKey);
        const expectedValue = DEFAULT_VALUES[optionalKey];

        expect(actualValue).toBe(expectedValue);
      }
    },
  );

  /**
   * Property 23: Sensitive values are redacted in logs
   * Feature: infrastructure-layer, Property 23: Sensitive values are redacted in logs
   */
  describe("Property 23: Sensitive values are redacted in logs", () => {
    test.prop(
      [
        fc.string({ minLength: 20, maxLength: 50 }),
        fc.string({ minLength: 20, maxLength: 50 }),
        fc.string({ minLength: 20, maxLength: 50 }),
      ],
      { numRuns: 30 },
    )(
      "redacts sensitive values from complex objects",
      (dbPassword, apiKey, secretToken) => {
        const config = {
          database: {
            host: "localhost",
            port: 5432,
            password: Redacted.make(dbPassword),
            user: "postgres",
          },
          apiKey: Redacted.make(apiKey),
          secretToken: Redacted.make(secretToken),
          normalValue: "this-is-fine",
        };

        const redacted = redactSensitiveConfig(config);
        const logOutput = JSON.stringify(redacted);

        // Sensitive values should not appear in output
        expect(logOutput).not.toContain(dbPassword);
        expect(logOutput).not.toContain(apiKey);
        expect(logOutput).not.toContain(secretToken);

        // Redaction marker should be present
        expect(logOutput).toContain("<redacted>");

        // Non-sensitive values should be preserved
        expect(logOutput).toContain("this-is-fine");
        expect(logOutput).toContain("localhost");
      },
    );

    test.prop([fc.string({ minLength: 10, maxLength: 30 })], { numRuns: 30 })(
      "handles Redacted type values properly",
      (secret) => {
        const redactedValue = Redacted.make(secret);
        const redacted = redactSensitiveConfig(redactedValue);

        expect(redacted).toBe("<redacted>");

        const stringified = JSON.stringify(redacted);
        expect(stringified).not.toContain(secret);
      },
    );

    test.prop(
      [
        fc.string({ minLength: 15, maxLength: 40 }),
        fc.string({ minLength: 15, maxLength: 40 }),
      ],
      { numRuns: 20 },
    )("redacts nested objects with sensitive keys", (password, token) => {
      const config = {
        level1: {
          level2: {
            password: password,
            apiKey: token,
            publicData: "visible",
          },
        },
      };

      const redacted = redactSensitiveConfig(config);
      const logOutput = JSON.stringify(redacted);

      // Sensitive values should be redacted
      expect(logOutput).not.toContain(password);
      expect(logOutput).not.toContain(token);
      expect(logOutput).toContain("<redacted>");

      // Public data should remain visible
      expect(logOutput).toContain("visible");
    });
  });
});
