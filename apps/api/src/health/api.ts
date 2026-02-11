import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";

const HealthStatus = Schema.Literal("healthy", "degraded", "unhealthy");

export class HealthGroup extends HttpApiGroup.make("health")
  .add(
    HttpApiEndpoint.get("check", "/").addSuccess(
      Schema.Struct({
        status: HealthStatus,
        timestamp: Schema.DateTimeUtc,
        components: Schema.Record({
          key: Schema.String,
          value: Schema.Struct({
            status: HealthStatus,
            latency: Schema.optional(Schema.Number),
            error: Schema.optional(Schema.String),
          }),
        }),
      }),
    ),
  )
  .prefix("/health") {}
