import { type Effect, Fiber } from "effect";
import { fromPromise, type PromiseActorLogic } from "xstate";
import { ApiRuntime } from "@/api/client";

/**
 * Bridges an Effect program into an XState@5 actor (PromiseActorLogic).
 * Supports optional input passing and handles Fiber interruption when the actor is stopped.
 *
 * @param effectOrFactory - An Effect or a function that takes input and returns an Effect.
 */
export const fromEffect = <A, E, R, TInput = void>(
  effectOrFactory:
    | Effect.Effect<A, E, R>
    | ((input: TInput) => Effect.Effect<A, E, R>),
): PromiseActorLogic<A, TInput> => {
  return fromPromise(async ({ input, signal }) => {
    const effect =
      typeof effectOrFactory === "function"
        ? effectOrFactory(input)
        : effectOrFactory;

    // Use runFork to execute the effect in the background as a Fiber
    const fiber = ApiRuntime.runFork(effect as any);

    // If XState signals abortion (actor stopped), interrupt the Fiber immediately
    signal.addEventListener("abort", () => {
      ApiRuntime.runFork(Fiber.interrupt(fiber));
    });

    // Wait for the Fiber to complete or fail
    return ApiRuntime.runPromise(Fiber.join(fiber)) as Promise<A>;
  });
};
