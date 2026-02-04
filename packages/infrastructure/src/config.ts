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

const isProduction = process.env.NODE_ENV === "production";

const secret = (name: string, mock: string) => {
  const config = Config.redacted(name);
  return isProduction
    ? config
    : config.pipe(Config.withDefault(Redacted.make(mock)));
};

export const SecretsConfig = Config.all({
  stripeKey: secret("STRIPE_API_KEY", "sk_test_mock"),
  sendgridKey: secret("SENDGRID_API_KEY", "sg_test_mock"),
  resendKey: secret("RESEND_API_KEY", "resend_test_mock"),
});
