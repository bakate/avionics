import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";

export class TransientError extends Schema.TaggedError<TransientError>()(
  "TransientError",
  {
    message: Schema.String,
  },
) {}

export class WebhookAuthenticationError extends Schema.TaggedError<WebhookAuthenticationError>()(
  "WebhookAuthenticationError",
  {},
) {}

export class MalformedPayloadError extends Schema.TaggedError<MalformedPayloadError>()(
  "MalformedPayloadError",
  {
    message: Schema.String,
  },
) {}

export class WebhookGroup extends HttpApiGroup.make("webhooks")
  .add(
    HttpApiEndpoint.post("polar", "/polar")
      .addSuccess(Schema.Struct({ received: Schema.Boolean }))
      .addError(TransientError, { status: 503 })
      .addError(WebhookAuthenticationError, { status: 401 })
      .addError(MalformedPayloadError, { status: 400 }),
  )
  .prefix("/webhooks") {}
