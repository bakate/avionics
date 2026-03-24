import { EventBus } from "@workspace/application/ports/event-bus";
import { type DomainEventType } from "@workspace/domain/events";
import { Effect, Layer, Queue, Stream } from "effect";

export { EventBus };

/**
 * Live Layer — Simple In-Memory Event Bus with background worker.
 */
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

          // Return the unsubscribe effect
          return Effect.sync(() => {
            const currentList = subscribers.get(type) || [];
            const newList = currentList.filter((h) => h !== safeHandler);
            if (newList.length === 0) {
              subscribers.delete(type);
            } else {
              subscribers.set(type, newList);
            }
          });
        }),
    };
  }),
);

function hasTag(u: unknown): u is { _tag: string } {
  return typeof u === "object" && u !== null && "_tag" in u;
}
