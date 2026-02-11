import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";

export class TransientError extends Schema.TaggedError<TransientError>()(
  "TransientError",
  {
    message: Schema.String,
  },
) {}

export class WebhookGroup extends HttpApiGroup.make("webhooks")
  .add(
    HttpApiEndpoint.post("polar", "/polar")
      .setPayload(
        Schema.Struct({
          type: Schema.String,
          data: Schema.Any,
        }),
      )
      .addSuccess(Schema.Struct({ received: Schema.Boolean }))
      .addError(TransientError, { status: 503 }),
  )
  .prefix("/webhooks") {}
