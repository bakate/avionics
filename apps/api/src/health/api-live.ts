import { HttpApiBuilder } from "@effect/platform";
import { HealthCheck } from "@workspace/infrastructure/health-check";
import { DateTime, Effect } from "effect";
import { Api } from "../api.js";

interface ComponentHealth {
  readonly status: "healthy" | "degraded" | "unhealthy";
  readonly latency?: number | undefined;
  readonly error?: string | undefined;
}

export const HealthApiLive = HttpApiBuilder.group(Api, "health", (handlers) =>
  handlers.handle("check", () =>
    Effect.gen(function* () {
      const health = yield* HealthCheck;
      const result = yield* health.check();

      const components: Record<string, ComponentHealth> = {};
      for (const c of result.components) {
        components[c.name] = {
          status: c.status,
          latency: c.latencyMs,
          error: c.message,
        };
      }

      return {
        status: result.status,
        timestamp: DateTime.unsafeMake(result.timestamp),
        components,
      };
    }).pipe(
      Effect.catchAll(() =>
        Effect.succeed({
          status: "unhealthy" as const,
          timestamp: DateTime.unsafeNow(),
          components: {},
        }),
      ),
    ),
  ),
);
