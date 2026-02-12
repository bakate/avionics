import { Layer } from "effect";
import { ConnectionPoolLive } from "./db/connection.js";
import { EventBus } from "./events/event-bus.js";
import { OutboxProcessorLive } from "./events/outbox-processor.js";
import { TransactionalOutboxLive } from "./events/transactional-outbox.js";
import { HttpCurrencyConverterGatewayLive } from "./gateways/currency-converter.gateway.js";
import { ResendNotificationGatewayLive } from "./gateways/notification-gateway.js";
import { PolarPaymentGatewayLive } from "./gateways/payment-gateway.js";
import { PostgresBookingQueriesLive } from "./queries/booking-queries.js";
import { PostgresInventoryQueriesLive } from "./queries/inventory-queries.js";
import { PostgresBookingRepositoryLive } from "./repositories/postgres-booking.repository.js";
import { PostgresInventoryRepositoryLive } from "./repositories/postgres-inventory.repository.js";
import { PostgresOutboxRepositoryLive } from "./repositories/postgres-outbox.repository.js";
import { PostgresTicketRepositoryLive } from "./repositories/postgres-ticket.repository.js";
import { PostgresUnitOfWorkLive } from "./repositories/unit-of-work.js";
import { AuditLoggerLive } from "./services/audit-logger.js";
import { HealthCheckLive } from "./services/health-check.js";
import { ShutdownManagerLive } from "./services/shutdown-manager.js";

export { PostgresBookingQueriesLive } from "./queries/booking-queries.js";
export { PostgresInventoryQueriesLive } from "./queries/inventory-queries.js";

// --- 1. Infrastructure Foundation ---
// These provide the base tags: SqlClient and EventBus
const CoreLive = Layer.merge(ConnectionPoolLive, EventBus.Live);

// --- 2. Base Infrastructure Services ---
// These depend on Core (Database) and provide: AuditLogger, HealthCheck, ShutdownManager
const ServicesLive = Layer.mergeAll(
  AuditLoggerLive,
  HealthCheckLive(),
  ShutdownManagerLive(),
).pipe(Layer.provideMerge(CoreLive));

// --- 3. Application Adapters (Repositories, Queries, Gateways) ---
export const CoreAdaptersLive = Layer.mergeAll(
  PostgresBookingRepositoryLive,
  PostgresInventoryRepositoryLive,
  PostgresTicketRepositoryLive,
  PostgresOutboxRepositoryLive,
  PostgresUnitOfWorkLive,
  PostgresBookingQueriesLive,
  PostgresInventoryQueriesLive,
  HttpCurrencyConverterGatewayLive,
  ResendNotificationGatewayLive,
  PolarPaymentGatewayLive,
).pipe(Layer.provideMerge(ServicesLive));

// --- 4. Background Workers (Processes that consume the domain) ---
export const BackgroundWorkersLive = Layer.mergeAll(
  OutboxProcessorLive,
  TransactionalOutboxLive,
).pipe(Layer.provideMerge(CoreAdaptersLive));

// --- 5. Final Unified Layer ---
export const InfrastructureLive = Layer.merge(
  CoreAdaptersLive,
  BackgroundWorkersLive,
);
