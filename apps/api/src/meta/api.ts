import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";

export class MetaGroup extends HttpApiGroup.make("meta")
  .add(
    HttpApiEndpoint.get("meta", "/meta").addSuccess(
      Schema.Struct({
        version: Schema.String,
        startedAt: Schema.DateTimeUtc,
      }),
    ),
  )
  .prefix("/") {}
