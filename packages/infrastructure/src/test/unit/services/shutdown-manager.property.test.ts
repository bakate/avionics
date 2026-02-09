import { fc, test } from "@fast-check/vitest";
import { Effect, Ref } from "effect";
import { describe, expect, it } from "vitest";
import { ShutdownManager } from "../../../services/shutdown-manager.js";

const PROPERTIES = {
  SHUTDOWN_CLOSES_CONNECTIONS: {
    number: 28,
    text: "Shutdown closes database connections",
  },
} as const;

describe("ShutdownManager Property Tests", () => {
  test.prop(
    [fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 })],
    {
      numRuns: 15,
    },
  )(
    `Property ${PROPERTIES.SHUTDOWN_CLOSES_CONNECTIONS.number}: ${PROPERTIES.SHUTDOWN_CLOSES_CONNECTIONS.text}`,
    async (handlerNames) => {
      const executedHandlersRef = Ref.unsafeMake<ReadonlyArray<string>>([]);

      const testLayer = ShutdownManager.Test();

      const program = Effect.gen(function* () {
        const shutdownManager = yield* ShutdownManager;

        for (const name of handlerNames) {
          yield* shutdownManager.registerCleanup(
            name,
            Ref.update(executedHandlersRef, (handlers) => [...handlers, name]),
          );
        }

        yield* shutdownManager.shutdown();
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));

      const executedHandlers = Ref.get(executedHandlersRef).pipe(
        Effect.runSync,
      );

      expect(executedHandlers.length).toBe(handlerNames.length);
      // Handlers should be executed in reverse order (LIFO)
      expect(executedHandlers).toEqual([...handlerNames].reverse());
    },
  );

  test.prop(
    [fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 })],
    {
      numRuns: 10,
    },
  )(
    "Property 28b: Cleanup handlers errors don't stop the shutdown",
    async (handlerNames) => {
      const executedHandlersRef = Ref.unsafeMake<ReadonlyArray<string>>([]);

      const testLayer = ShutdownManager.Test();

      const program = Effect.gen(function* () {
        const shutdownManager = yield* ShutdownManager;

        const mid = Math.floor(handlerNames.length / 2);
        const firstHalf = handlerNames.slice(0, mid);
        const secondHalf = handlerNames.slice(mid);

        for (const name of firstHalf) {
          yield* shutdownManager.registerCleanup(
            name,
            Ref.update(executedHandlersRef, (handlers) => [...handlers, name]),
          );
        }

        // Register a failing handler intentionally between groups to verify mid-sequence resilience
        yield* shutdownManager.registerCleanup(
          "failing",
          Effect.fail(new Error("Boom")),
        );

        for (const name of secondHalf) {
          yield* shutdownManager.registerCleanup(
            name,
            Ref.update(executedHandlersRef, (handlers) => [...handlers, name]),
          );
        }

        yield* shutdownManager.shutdown().pipe(
          Effect.catchTag("ShutdownError", (error) =>
            Effect.gen(function* () {
              expect(error.failures.length).toBe(1);
              expect(error.failures[0]?.name).toBe("failing");
              return yield* Effect.void;
            }),
          ),
        );
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));

      const executedHandlers = Ref.get(executedHandlersRef).pipe(
        Effect.runSync,
      );

      // All handlers should still run despite the failure
      expect(executedHandlers.length).toBe(handlerNames.length);
    },
  );

  it("Property 28d: Shutdown transitions through expected stages", async () => {
    const testLayer = ShutdownManager.Test();

    const program = Effect.gen(function* () {
      const shutdownManager = yield* ShutdownManager;

      const stateBefore = yield* shutdownManager.getState();
      expect(stateBefore.stage).toBe("running");

      yield* shutdownManager.shutdown();

      const stateAfter = yield* shutdownManager.getState();
      expect(stateAfter.stage).toBe("completed");
      expect(stateAfter.startedAt).toBeInstanceOf(Date);
      expect(stateAfter.completedAt).toBeInstanceOf(Date);
    });

    await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
  });

  it("Property 28e: isShuttingDown returns true after shutdown starts", async () => {
    const testLayer = ShutdownManager.Test();

    const program = Effect.gen(function* () {
      const shutdownManager = yield* ShutdownManager;

      const beforeShutdown = yield* shutdownManager.isShuttingDown();
      expect(beforeShutdown).toBe(false);

      yield* shutdownManager.shutdown();

      const afterShutdown = yield* shutdownManager.isShuttingDown();
      expect(afterShutdown).toBe(true);
    });

    await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
  });
});
