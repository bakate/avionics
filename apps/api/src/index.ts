import { createServer } from "node:http";
import { HttpApiBuilder, HttpMiddleware } from "@effect/platform";
import {
  NodeContext,
  NodeHttpServer,
  NodeRuntime,
} from "@effect/platform-node";
import { BookingService } from "@workspace/application/booking.service";
import { CancellationService } from "@workspace/application/cancellation.service";
import { InventoryService } from "@workspace/application/inventory.service";
import { OutboxProcessorLive } from "@workspace/application/jobs/outbox-processor";
import { ApiConfig } from "@workspace/config";
import {
  BackgroundWorkersLive,
  CoreAdaptersLive,
} from "@workspace/infrastructure";
import { ConfigProvider, Effect, Layer } from "effect";
import { Api } from "./api.js";
import { BookingApiLive } from "./booking/api-live.js";
import { HealthApiLive } from "./health/api-live.js";
import { InventoryApiLive } from "./inventory/api-live.js";
import { MetaApiLive } from "./meta/api-live.js";
import { WebhookApiLive } from "./webhook/api-live.js";

// ============================================================================
// Layer Hierarchy: Dependency Injection Graph
// ============================================================================

/**
 * 1. Base Infrastructure (Database, EventBus, Node Context)
 */
const InfraLive = Layer.mergeAll(CoreAdaptersLive, NodeContext.layer);

/**
 * 2. Domain Services with internal dependencies.
 * We must use provideMerge/provide to satisfy inter-service dependencies.
 */

// InventoryService only needs Infrastructure
const InventoryLive = InventoryService.Live.pipe(Layer.provide(InfraLive));

// BookingService needs both Infrastructure and InventoryService
const BookingLive = BookingService.Live.pipe(
  Layer.provide(InventoryLive),
  Layer.provide(InfraLive),
);

// CancellationService needs both Infrastructure and InventoryService
const CancellationLive = CancellationService.Live.pipe(
  Layer.provide(InventoryLive),
  Layer.provide(InfraLive),
);

/**
 * 3. Unified Application Services Layer
 */
const AppServicesLive = Layer.mergeAll(
  InventoryLive,
  BookingLive,
  CancellationLive,
);

// ============================================================================
// API Handlers & HTTP Layer
// ============================================================================

const HandlersLive = Layer.mergeAll(
  BookingApiLive,
  InventoryApiLive,
  HealthApiLive,
  MetaApiLive,
  WebhookApiLive,
);

const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(HandlersLive),
  Layer.provide(AppServicesLive),
);

const ServerLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* ApiConfig;
    return HttpApiBuilder.serve(
      HttpMiddleware.cors({
        allowedOrigins: config.corsOrigins,
        allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization", "B3", "traceparent"],
      }),
    ).pipe(
      Layer.provide(ApiLive),
      Layer.provide(NodeHttpServer.layer(createServer, { port: config.port })),
    );
  }),
).pipe(Layer.provide(InfraLive));

// ============================================================================
// Workers & Execution Entry Point
// ============================================================================

const WorkersLive = Layer.mergeAll(
  BackgroundWorkersLive,
  OutboxProcessorLive,
  Layer.scopedDiscard(
    Effect.gen(function* () {
      const cancellation = yield* CancellationService;
      // Tie the cancellation fiber to the application scope so it interrupts on shutdown
      yield* cancellation.start().pipe(Effect.forkScoped);
    }),
  ),
).pipe(Layer.provide(AppServicesLive), Layer.provide(InfraLive));

const MainLive = Layer.mergeAll(ServerLive, WorkersLive).pipe(
  Layer.provide(Layer.setConfigProvider(ConfigProvider.fromEnv())),
);

const program = Effect.scoped(Layer.launch(MainLive)).pipe(
  Effect.catchAllCause((cause) =>
    Effect.logFatal("Fatal error in main program", cause).pipe(
      Effect.flatMap(() => Effect.failCause(cause)),
    ),
  ),
  Effect.onInterrupt(() => Effect.logInfo("🛑 Shutting down backend...")),
);

// We use runMain to execute the program. The type is explicitlynever for success and requirements.
NodeRuntime.runMain(program as Effect.Effect<never, any, never>);
