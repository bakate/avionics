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
>() {}

// Simple In-Memory Event Bus for now (Concept)
// Real implementation would involve Redis/Kafka or just internal Queue if monolithic.
export const EventBusLive = Layer.scoped(
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
          // Schema.Class adds __tag, but TS sometimes loses it in Union if not explicit
          // Safe cast for routing
          const tag = (event as unknown as { _tag: string })._tag;
          const handlers = subscribers.get(tag) || [];
          yield* Effect.all(
            handlers.map((h) =>
              h(event).pipe(
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
          // We cast safely because we filter by type on dispatch usually,
          // or we can wrap handler to validate.
          // For now, let's keep strict types internally.
          const safeHandler = (e: DomainEventType) => handler(e);
          subscribers.set(type, [...list, safeHandler]);
        }),
    };
  }),
);

// Helper type guard
function hasTag(u: unknown): u is { _tag: string } {
  return typeof u === "object" && u !== null && "_tag" in u;
}
