import { Config, Effect, Redacted } from "effect";

export const DatabaseConfig = Config.all({
  host: Config.string("DB_HOST"),
  port: Config.number("DB_PORT").pipe(Config.withDefault(5432)),
  database: Config.string("DB_NAME").pipe(Config.withDefault("avionics")),
  user: Config.string("DB_USER").pipe(Config.withDefault("postgres")),
  password: Config.redacted("DB_PASSWORD"),
  poolMin: Config.number("DB_POOL_MIN").pipe(Config.withDefault(2)),
  poolMax: Config.number("DB_POOL_MAX").pipe(Config.withDefault(10)),
  url: Config.string("DATABASE_URL").pipe(Config.option), // Optional Override
});

export const SecretsConfig = Config.all({
  stripeKey: Config.redacted("STRIPE_API_KEY").pipe(
    Config.withDefault(Redacted.make("sk_test_mock")),
  ),
  sendgridKey: Config.redacted("SENDGRID_API_KEY").pipe(
    Config.withDefault(Redacted.make("sg_test_mock")),
  ),
  resendKey: Config.redacted("RESEND_API_KEY").pipe(
    Config.withDefault(Redacted.make("resend_test_mock")),
  ),
});
