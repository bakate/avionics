import { Context, Duration, Effect, Layer, Ref } from "effect";

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
  readonly getState: () => Effect.Effect<ShutdownState>;
  readonly shutdown: () => Effect.Effect<void, never, never>;
  readonly registerCleanup: (
    name: string,
    handler: Effect.Effect<void, never, never>,
  ) => Effect.Effect<void, never, never>;
  readonly isShuttingDown: () => Effect.Effect<boolean>;
}

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
  /**
   * Internal constructor logic shared between Live and Test.
   */
  private static make = (config: Partial<ShutdownManagerConfig> = {}) =>
    Effect.gen(function* () {
      const finalConfig = { ...DEFAULT_CONFIG, ...config };

      const stateRef = yield* Ref.make<ShutdownState>({
        stage: "running",
        startedAt: null,
        completedAt: null,
      });

      const cleanupHandlers = yield* Ref.make<
        ReadonlyArray<{
          name: string;
          handler: Effect.Effect<void, never, never>;
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

          for (const { name, handler } of reversedHandlers) {
            yield* Effect.logInfo(`Running cleanup handler: ${name}`);
            yield* handler.pipe(
              Effect.catchAll((error) =>
                Effect.logWarning(`Cleanup handler ${name} failed`, {
                  error: String(error),
                }),
              ),
            );
          }
        });

      const shutdownProgram: Effect.Effect<void, never, never> = Effect.gen(
        function* () {
          const currentState = yield* Ref.get(stateRef);
          if (currentState.stage !== "running") return;

          yield* Ref.set(stateRef, {
            stage: "stopping_requests",
            startedAt: new Date(),
            completedAt: null,
          });

          yield* Effect.logInfo("Starting graceful shutdown...");

          yield* setStage("completing_transactions");
          yield* setStage("stopping_processor");
          yield* setStage("closing_connections");
          yield* executeCleanupHandlers();
          yield* setStage("completed");

          yield* Effect.logInfo("Graceful shutdown completed");
        },
      ).pipe(
        Effect.timeout(Duration.seconds(finalConfig.gracePeriodSeconds)),
        Effect.catchAll(() =>
          Effect.gen(function* () {
            yield* Effect.logError(
              `Shutdown timed out after ${finalConfig.gracePeriodSeconds}s, forcing completion state`,
            );
            yield* setStage("completed");
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
            handler: Effect.Effect<void, never, never>,
          ) => Ref.update(cleanupHandlers, (hs) => [...hs, { name, handler }]),
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
          process.once("SIGTERM", () => Effect.runFork(shutdownProgram));
          process.once("SIGINT", () => Effect.runFork(shutdownProgram));
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
    config: Partial<ShutdownManagerConfig> = { gracePeriodSeconds: 1 }, // Faster for tests
  ) =>
    Layer.effect(
      ShutdownManager,
      Effect.gen(function* () {
        const { impl } = yield* ShutdownManager.make(config);
        return { ...impl, ...overrides };
      }),
    );
}
