import { type DomainEventType } from "@workspace/domain/events";
import { Context, Effect, Layer, Queue, Stream } from "effect";

export interface EventBusPort {
  readonly publish: (event: unknown) => Effect.Effect<void>;
  readonly subscribe: (
    eventType: string,
    handler: (event: unknown) => Effect.Effect<void>,
  ) => Effect.Effect<void>;
}

export class EventBus extends Context.Tag("EventBus")<
  EventBus,
  EventBusPort
>() {
  /**
   * Live Layer — Simple In-Memory Event Bus with background worker.
   * Real implementation would involve Redis/Kafka.
   */
  static readonly Live = Layer.scoped(
    EventBus,
    Effect.gen(function* () {
      const queue = yield* Queue.unbounded<DomainEventType>();
      const subscribers = new Map<
        string,
        Array<(e: DomainEventType) => Effect.Effect<void>>
      >();

      // Background worker to consume queue
      yield* Stream.fromQueue(queue).pipe(
        Stream.runForEach((event) =>
          Effect.gen(function* () {
            // Safe cast for routing
            const tag = (event as unknown as { _tag: string })._tag;
            const handlers = subscribers.get(tag) || [];
            yield* Effect.all(
              handlers.map((h) =>
                h(event).pipe(
                  Effect.catchAll((e) =>
                    Effect.logError("Event Handler Error", e),
                  ),
                  Effect.catchAllDefect((e) =>
                    Effect.logError("Event Handler Fault", e),
                  ),
                ),
              ),
              { concurrency: "unbounded" },
            );
          }),
        ),
        Effect.forkScoped,
      );

      return {
        publish: (event: unknown) => {
          if (hasTag(event)) {
            return Queue.offer(queue, event as unknown as DomainEventType).pipe(
              Effect.asVoid,
            );
          }
          return Effect.die(new Error("Event must have _tag"));
        },
        subscribe: (
          type: string,
          handler: (event: unknown) => Effect.Effect<void>,
        ) =>
          Effect.sync(() => {
            const list = subscribers.get(type) || [];
            const safeHandler = (e: DomainEventType) => handler(e);
            subscribers.set(type, [...list, safeHandler]);
          }),
      };
    }),
  );

  /**
   * Test Layer — Factory that returns a complete Layer for tests.
   * Default behavior: No-op for publish and subscribe, can be overridden.
   */
  static readonly Test = (overrides: Partial<EventBusPort> = {}) =>
    Layer.succeed(
      EventBus,
      EventBus.of({
        publish: () => Effect.void,
        subscribe: () => Effect.void,
        ...overrides,
      }),
    );
}

// Helper type guard
function hasTag(u: unknown): u is { _tag: string } {
  return typeof u === "object" && u !== null && "_tag" in u;
}
