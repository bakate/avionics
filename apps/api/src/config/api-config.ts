import { Config, ConfigError, Either } from "effect";

/**
 * API Server Configuration
 */
export const ApiConfig = Config.all({
  port: Config.number("PORT").pipe(Config.withDefault(3000)),
  /**
   * CORS allowed origins.
   * MUST be explicitly set in non-development environments for security.
   * Defaults to an empty array (rejects all) if not provided.
   */
  corsOrigins: Config.array(Config.string()).pipe(
    Config.withDefault([] as Array<string>),
    Config.nested("CORS_ORIGINS"),
    Config.mapOrFail((origins) => {
      if (process.env.NODE_ENV !== "development" && origins.length === 0) {
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
  nodeEnv: Config.string("NODE_ENV").pipe(Config.withDefault("development")),
});

export type ApiConfig = Config.Config.Success<typeof ApiConfig>;
