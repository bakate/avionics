import { HttpApiBuilder } from "@effect/platform";
import { DateTime, Effect } from "effect";
import { Api } from "../api.js";

const startedAt = DateTime.unsafeNow();
export const MetaApiLive = HttpApiBuilder.group(Api, "meta", (handlers) =>
  handlers.handle("meta", () =>
    Effect.succeed({
      version: "0.1.0",
      startedAt,
    }),
  ),
);
