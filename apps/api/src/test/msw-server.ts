import { PolarConfig } from "@workspace/config";
import { Effect } from "effect";
import { setupServer } from "msw/node";
import { makeHandlers } from "./msw-handlers.js";

// Resolve config synchronously for MSW initialization
// In Effect 3, Config<A> is an Effect<A, ConfigError, never>
const config = Effect.runSync(PolarConfig);

export const mswServer = setupServer(...makeHandlers(config.baseUrl));
