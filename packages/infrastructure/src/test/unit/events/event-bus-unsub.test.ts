import { EventBus } from "@workspace/application/ports/event-bus";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { EventBusLive } from "../../../events/event-bus.js";

describe("EventBus Unsubscribe", () => {
  it("should not receive events after unsubscribing", async () => {
    const program = Effect.gen(function* () {
      const eb = yield* EventBus;
      let count = 0;

      // subscribe returns an unsubscribe effect
      const unsubscribeEffect = yield* eb.subscribe("TestEvent", () =>
        Effect.sync(() => {
          count++;
        }),
      );

      // Publish first event
      yield* eb.publish({ _tag: "TestEvent", data: 1 });

      // We need to wait a tiny bit for the async processing in EventBusLive
      yield* Effect.sleep("100 millis");
      expect(count).toBe(1);

      // Unsubscribe by running the returned Effect
      yield* unsubscribeEffect;

      // Publish second event
      yield* eb.publish({ _tag: "TestEvent", data: 2 });
      yield* Effect.sleep("100 millis");

      // Count should still be 1
      expect(count).toBe(1);
    });

    await Effect.runPromise(
      program.pipe(Effect.provide(EventBusLive), Effect.scoped),
    );
  });
});
