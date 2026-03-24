import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform";
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
  .add(HttpApiEndpoint.get("openApi", "/openapi.json").addSuccess(Schema.Any))
  .add(
    HttpApiEndpoint.get("docs", "/docs").addSuccess(
      HttpApiSchema.Text({ contentType: "text/html" }),
    ),
  )
  .prefix("/") {}
