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
    const queue = yield* Queue.unbounded<any>();
    const subscribers = new Map<
      string,
      Array<(e: any) => Effect.Effect<void>>
    >();

    // Background worker to consume queue
    yield* Stream.fromQueue(queue).pipe(
      Stream.runForEach((event) =>
        Effect.gen(function* () {
          const handlers = subscribers.get(event._tag) || [];
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
      publish: (event: unknown) =>
        Queue.offer(queue, event).pipe(Effect.asVoid),
      subscribe: (
        type: string,
        handler: (event: unknown) => Effect.Effect<void>,
      ) =>
        Effect.sync(() => {
          const list = subscribers.get(type) || [];
          subscribers.set(type, [...list, handler]);
        }),
    };
  }),
);
