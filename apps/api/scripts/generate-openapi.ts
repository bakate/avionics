import { FileSystem, OpenApi, Path } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { ApiConfig } from "@workspace/config";
import { ConfigProvider, Console, Effect } from "effect";
import { Api } from "../src/api.js";
import { transformSpec } from "../src/lib/openapi-examples.js";

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const config = yield* ApiConfig;

  const spec = OpenApi.fromApi(Api);
  const transformed = transformSpec(spec);

  const productionSpec = {
    ...transformed,
    servers: [
      {
        url: config.apiUrl,
        description: "API Server",
      },
    ],
  };

  const outputPath = path.resolve(process.cwd(), "../../openapi.json");

  yield* fs.writeFileString(
    outputPath,
    JSON.stringify(productionSpec, null, 2),
  );
  yield* Console.log(`✅ OpenAPI specification generated at: ${outputPath}`);
});

NodeRuntime.runMain(
  program.pipe(
    Effect.provide(NodeContext.layer),
    Effect.withConfigProvider(ConfigProvider.fromEnv()),
  ) as Effect.Effect<void, unknown, never>,
);
