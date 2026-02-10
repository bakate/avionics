import { Context, Data, Duration, Effect, Layer, Ref } from "effect";

type ShutdownStage =
  | "running"
  | "stopping_requests"
  | "completing_transactions"
  | "stopping_processor"
  | "closing_connections"
  | "completed";

export interface ShutdownState {
  readonly stage: ShutdownStage;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
}

export interface ShutdownManagerSignature {
  /**
   * Get current shutdown state
   */
  readonly getState: () => Effect.Effect<ShutdownState>;

  /**
   * Initiate graceful shutdown
   * Will execute all registered cleanup handlers in reverse order
   */
  readonly shutdown: () => Effect.Effect<void, ShutdownError>;

  /**
   * Register a cleanup handler to run during shutdown
   * Handlers are executed in LIFO order (last registered runs first)
   *
   * @param name - Unique identifier for this cleanup handler
   * @param handler - Effect to run during shutdown
   *                  Errors are caught and logged, but don't stop other handlers
   */
  readonly registerCleanup: (
    name: string,
    handler: Effect.Effect<void, any>,
  ) => Effect.Effect<void>;

  /**
   * Check if shutdown is in progress
   */
  readonly isShuttingDown: () => Effect.Effect<boolean>;
}

/**
 * Error type for shutdown failures
 */
export class ShutdownError extends Data.TaggedError("ShutdownError")<{
  readonly failures: ReadonlyArray<{
    readonly name: string;
    readonly error: unknown;
  }>;
}> {}

export interface ShutdownManagerConfig {
  readonly gracePeriodSeconds: number;
}

const DEFAULT_CONFIG: ShutdownManagerConfig = {
  gracePeriodSeconds: 30,
};

export class ShutdownManager extends Context.Tag("ShutdownManager")<
  ShutdownManager,
  ShutdownManagerSignature
>() {}
const makeShutdownManager = (config: Partial<ShutdownManagerConfig> = {}) =>
  Effect.gen(function* () {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    const stateRef = yield* Ref.make<ShutdownState>({
      stage: "running",
      startedAt: null,
      completedAt: null,
    });

    // Store handlers with their full Effect type
    const cleanupHandlers = yield* Ref.make<
      ReadonlyArray<{
        name: string;
        handler: Effect.Effect<void, any>;
      }>
    >([]);

    const setStage = (stage: ShutdownStage) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) => ({
          ...state,
          stage,
          ...(stage === "completed" ? { completedAt: new Date() } : {}),
        }));
        yield* Effect.logInfo(`Shutdown stage: ${stage}`);
      });

    const executeCleanupHandlers = () =>
      Effect.gen(function* () {
        const handlers = yield* Ref.get(cleanupHandlers);
        const reversedHandlers = [...handlers].reverse();
        const failures: Array<{ name: string; error: unknown }> = [];

        for (const { name, handler } of reversedHandlers) {
          yield* Effect.logInfo(`Running cleanup handler: ${name}`);

          // Catch all errors (including defects)
          yield* handler.pipe(
            Effect.catchAllCause((cause) =>
              Effect.gen(function* () {
                failures.push({ name, error: cause });
                yield* Effect.logWarning(`Cleanup handler ${name} failed`, {
                  error: String(cause),
                });
              }),
            ),
          );
        }

        // Return failures for potential error reporting
        return failures;
      });

    const shutdownProgram: Effect.Effect<void, ShutdownError> = Effect.gen(
      function* () {
        const isShuttingDown = yield* Ref.modify(stateRef, (state) => {
          if (state.stage !== "running") {
            return [false, state];
          }
          return [
            true,
            {
              ...state,
              stage: "stopping_requests",
              startedAt: new Date(),
            } as ShutdownState,
          ];
        });

        if (!isShuttingDown) {
          return;
        }

        yield* Effect.logInfo("Starting graceful shutdown...");

        yield* setStage("completing_transactions");
        yield* setStage("stopping_processor");
        yield* setStage("closing_connections");

        const failures = yield* executeCleanupHandlers().pipe(
          Effect.timeout(Duration.seconds(finalConfig.gracePeriodSeconds)),
          Effect.catchTag("TimeoutException", () =>
            Effect.gen(function* () {
              yield* Effect.logError(
                `Shutdown timed out after ${finalConfig.gracePeriodSeconds}s, forcing completion`,
              );
              return [
                {
                  name: "TimeoutException",
                  error: `Shutdown timed out after ${finalConfig.gracePeriodSeconds}s`,
                },
              ];
            }),
          ),
        );

        yield* setStage("completed");

        if (failures.length > 0) {
          yield* Effect.logWarning(
            `Shutdown completed with ${failures.length} handler failure(s)`,
            { failures },
          );
          return yield* Effect.fail(new ShutdownError({ failures }));
        }

        yield* Effect.logInfo("Graceful shutdown completed successfully");
      },
    );
    return {
      stateRef,
      shutdownProgram,
      cleanupHandlers,
      impl: {
        getState: () => Ref.get(stateRef),

        isShuttingDown: () =>
          Ref.get(stateRef).pipe(Effect.map((s) => s.stage !== "running")),

        registerCleanup: (
          name: string,
          handler: Effect.Effect<void, any>,
        ): Effect.Effect<void> =>
          Ref.update(cleanupHandlers, (hs) => [...hs, { name, handler }]),

        shutdown: () => shutdownProgram,
      },
    };
  });

/**
 * Live Layer — Includes OS signal handling.
 */
export const ShutdownManagerLive = (
  config: Partial<ShutdownManagerConfig> = {},
) =>
  Layer.effect(
    ShutdownManager,
    Effect.gen(function* () {
      const { impl, shutdownProgram } = yield* makeShutdownManager(config);

      if (typeof process !== "undefined") {
        const handleSignal = (signal: string) => {
          Effect.runCallback(shutdownProgram, {
            onExit: (exit) => {
              if (exit._tag === "Failure") {
                // biome-ignore lint/suspicious/noConsole: Final signal handler error logging
                console.error(
                  `Graceful shutdown failed [${signal}]:`,
                  exit.cause,
                );
                process.exit(1);
              } else {
                process.exit(0);
              }
            },
          });
        };

        process.once("SIGTERM", () => handleSignal("SIGTERM"));
        process.once("SIGINT", () => handleSignal("SIGINT"));
      }

      return impl;
    }),
  );

/**
 * Test Layer — Same logic as Live, but no side-effects on process signals.
 * Encourages realistic testing of the shutdown sequence.
 */
export const ShutdownManagerTest = (
  overrides: Partial<ShutdownManagerSignature> = {},
  config: Partial<ShutdownManagerConfig> = { gracePeriodSeconds: 1 },
) =>
  Layer.effect(
    ShutdownManager,
    Effect.gen(function* () {
      const { impl } = yield* makeShutdownManager(config);
      return { ...impl, ...overrides };
    }),
  );
