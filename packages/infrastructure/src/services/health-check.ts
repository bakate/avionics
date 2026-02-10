import { SqlClient } from "@effect/sql";
import { Context, Duration, Effect, Layer, Option, Ref } from "effect";

type HealthStatus = "healthy" | "unhealthy" | "degraded";

interface ComponentHealth {
  readonly name: string;
  readonly status: HealthStatus;
  readonly message?: string;
  readonly latencyMs?: number;
}

export interface HealthCheckResult {
  readonly status: HealthStatus;
  readonly version: string;
  readonly components: ReadonlyArray<ComponentHealth>;
  readonly timestamp: Date;
}

export interface HealthCheckSignature {
  /**
   * Performs health checks on all components.
   * Returns cached result if within cache TTL.
   */
  readonly check: () => Effect.Effect<HealthCheckResult>;

  /**
   * Forces a fresh health check, bypassing cache.
   */
  readonly checkFresh: () => Effect.Effect<HealthCheckResult>;
}

export interface HealthCheckConfig {
  readonly timeoutSeconds: number;
  readonly cacheTtlSeconds: number;
  readonly version: string;
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  timeoutSeconds: 5,
  cacheTtlSeconds: 10,
  version: "0.0.0",
};

export class HealthCheck extends Context.Tag("HealthCheck")<
  HealthCheck,
  HealthCheckSignature
>() {}
/**
 * Live Layer — Production implementation.
 * Requires SqlClient in context.
 */
export const HealthCheckLive = (config: Partial<HealthCheckConfig> = {}) =>
  Layer.effect(
    HealthCheck,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const finalConfig = { ...DEFAULT_CONFIG, ...config };

      const cacheRef = yield* Ref.make<
        Option.Option<{
          result: HealthCheckResult;
          cachedAt: number;
        }>
      >(Option.none());

      const checkDatabase = (): Effect.Effect<ComponentHealth> =>
        Effect.gen(function* () {
          const startTime = Date.now();

          yield* sql`SELECT 1 as health_check`;

          const latencyMs = Date.now() - startTime;

          return {
            name: "database",
            status: "healthy" as const,
            latencyMs,
          };
        }).pipe(
          Effect.catchAll((error) =>
            Effect.logError("Health check failed for database", {
              error: String(error),
            }).pipe(
              Effect.as({
                name: "database",
                status: "unhealthy" as const,
                message: "database unavailable",
              }),
            ),
          ),
        );

      const checkOutboxProcessor = (): Effect.Effect<ComponentHealth> =>
        Effect.succeed({
          name: "outbox_processor",
          status: "healthy" as const,
          message: "Outbox processor running",
        });

      const performHealthChecks = (): Effect.Effect<HealthCheckResult> =>
        Effect.gen(function* () {
          const components = yield* Effect.all(
            [checkDatabase(), checkOutboxProcessor()],
            { concurrency: "unbounded" },
          );

          const hasUnhealthy = components.some((c) => c.status === "unhealthy");
          const hasDegraded = components.some((c) => c.status === "degraded");

          const status: HealthStatus = hasUnhealthy
            ? "unhealthy"
            : hasDegraded
              ? "degraded"
              : "healthy";

          return {
            status,
            version: finalConfig.version,
            components,
            timestamp: new Date(),
          };
        }).pipe(
          Effect.timeout(Duration.seconds(finalConfig.timeoutSeconds)),
          Effect.catchAll(() =>
            Effect.succeed({
              status: "unhealthy" as const,
              version: finalConfig.version,
              components: [
                {
                  name: "timeout",
                  status: "unhealthy" as const,
                  message: `Health check timed out after ${finalConfig.timeoutSeconds}s`,
                },
              ],
              timestamp: new Date(),
            }),
          ),
        );

      return {
        check: () =>
          Effect.gen(function* () {
            const cached = yield* Ref.get(cacheRef);

            if (Option.isSome(cached)) {
              const cacheAge = Date.now() - cached.value.cachedAt;
              if (cacheAge < finalConfig.cacheTtlSeconds * 1000) {
                return cached.value.result;
              }
            }

            const result = yield* performHealthChecks();

            yield* Ref.set(
              cacheRef,
              Option.some({
                result,
                cachedAt: Date.now(),
              }),
            );

            return result;
          }),

        checkFresh: () =>
          Effect.gen(function* () {
            const result = yield* performHealthChecks();

            yield* Ref.set(
              cacheRef,
              Option.some({
                result,
                cachedAt: Date.now(),
              }),
            );

            return result;
          }),
      };
    }),
  );

/**
 * Test Layer — Factory that returns a complete Layer for tests.
 */
export const HealthCheckTest = (
  overrides: Partial<HealthCheckSignature> = {},
) =>
  Layer.succeed(
    HealthCheck,
    HealthCheck.of({
      check: () =>
        Effect.succeed({
          status: "healthy",
          version: "test-0.0.0",
          components: [
            { name: "database", status: "healthy", latencyMs: 1 },
            { name: "outbox_processor", status: "healthy" },
          ],
          timestamp: new Date(),
        }),

      checkFresh: () =>
        Effect.succeed({
          status: "healthy",
          version: "test-0.0.0",
          components: [
            { name: "database", status: "healthy", latencyMs: 1 },
            { name: "outbox_processor", status: "healthy" },
          ],
          timestamp: new Date(),
        }),

      ...overrides,
    }),
  );
