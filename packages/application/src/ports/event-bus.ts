import { Context, type Effect } from "effect";

export interface EventBusPort {
  readonly publish: (event: unknown) => Effect.Effect<void>;
  readonly subscribe: (
    eventType: string,
    handler: (event: unknown) => Effect.Effect<void>,
  ) => Effect.Effect<Effect.Effect<void>>;
}

export class EventBus extends Context.Tag("EventBus")<
  EventBus,
  EventBusPort
>() {}
