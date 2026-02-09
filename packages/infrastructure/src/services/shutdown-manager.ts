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
>() {
  private static make = (config: Partial<ShutdownManagerConfig> = {}) =>
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
          const currentState = yield* Ref.get(stateRef);
          if (currentState.stage !== "running") {
            return;
          }

          yield* Ref.set(stateRef, {
            stage: "stopping_requests",
            startedAt: new Date(),
            completedAt: null,
          });

          yield* Effect.logInfo("Starting graceful shutdown...");

          yield* setStage("completing_transactions");
          yield* setStage("stopping_processor");
          yield* setStage("closing_connections");

          const failures = yield* executeCleanupHandlers();

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
      ).pipe(
        Effect.timeout(Duration.seconds(finalConfig.gracePeriodSeconds)),
        Effect.catchTag("TimeoutException", () =>
          Effect.gen(function* () {
            yield* Effect.logError(
              `Shutdown timed out after ${finalConfig.gracePeriodSeconds}s, forcing completion`,
            );
            yield* setStage("completed");
            return yield* Effect.fail(
              new ShutdownError({
                failures: [
                  {
                    name: "TimeoutException",
                    error: `Shutdown timed out after ${finalConfig.gracePeriodSeconds}s`,
                  },
                ],
              }),
            );
          }),
        ),
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
  static readonly Live = (config: Partial<ShutdownManagerConfig> = {}) =>
    Layer.effect(
      ShutdownManager,
      Effect.gen(function* () {
        const { impl, shutdownProgram } = yield* ShutdownManager.make(config);

        if (typeof process !== "undefined") {
          process.once("SIGTERM", () => {
            Effect.runFork(shutdownProgram);
          });
          process.once("SIGINT", () => {
            Effect.runFork(shutdownProgram);
          });
        }

        return impl;
      }),
    );

  /**
   * Test Layer — Same logic as Live, but no side-effects on process signals.
   * Encourages realistic testing of the shutdown sequence.
   */
  static readonly Test = (
    overrides: Partial<ShutdownManagerSignature> = {},
    config: Partial<ShutdownManagerConfig> = { gracePeriodSeconds: 1 },
  ) =>
    Layer.effect(
      ShutdownManager,
      Effect.gen(function* () {
        const { impl } = yield* ShutdownManager.make(config);
        return { ...impl, ...overrides };
      }),
    );
}
