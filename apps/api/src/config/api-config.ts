import { Config, ConfigError, Either } from "effect";

/**
 * API Server Configuration
 */
const nodeEnv = Config.string("NODE_ENV").pipe(
  Config.withDefault("development"),
);

export const ApiConfig = Config.all({
  port: Config.number("PORT").pipe(Config.withDefault(3000)),
  /**
   * CORS allowed origins.
   * MUST be explicitly set in non-development environments for security.
   * Defaults to an empty array (rejects all) if not provided.
   */
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
