import { ConfigProvider, Layer } from "effect";

// Layer to provide ConfigProvider that uses environment variables directly
// This avoids spinning up Docker containers and allows testing against Neon or local Postgres
export const PostgresContainer = Layer.setConfigProvider(
  ConfigProvider.fromEnv(),
);
