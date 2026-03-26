import { HttpApiBuilder, OpenApi } from "@effect/platform";
import { ApiConfig } from "@workspace/config";
import { DateTime, Effect } from "effect";
import { Api } from "../api.js";
import { transformSpec } from "../lib/openapi-examples.js";

const startedAt = DateTime.unsafeNow();

export const MetaApiLive = HttpApiBuilder.group(Api, "meta", (handlers) =>
  handlers
    .handle("meta", () =>
      Effect.succeed({
        version: "0.1.0",
        startedAt,
      }),
    )
    .handle("openApi", () =>
      Effect.gen(function* () {
        const config = yield* ApiConfig;
        const spec = OpenApi.fromApi(Api);
        const transformed = transformSpec(spec);

        return {
          ...transformed,
          servers: [{ url: config.apiUrl, description: "Server" }],
        };
      }).pipe(Effect.orDie),
    )
    .handle("docs", () =>
      Effect.succeed(`
<!doctype html>
<html>
  <head>
    <title>Avionics API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
      }
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/api/openapi.json"
    ></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>
`),
    ),
);
