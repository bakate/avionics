import { Layer } from "effect";
import { ConnectionPoolLive } from "./db/connection.js";
import { EventBus } from "./events/event-bus.js";
import { OutboxProcessorLive } from "./events/outbox-processor.js";
import { TransactionalOutboxLive } from "./events/transactional-outbox.js";
import { CurrencyConverterGatewayLive } from "./gateways/currency-converter.gateway.js";
import { NotificationGatewayLive } from "./gateways/notification-gateway.js";
import { PaymentGatewayLive } from "./gateways/payment-gateway.js";
import { BookingQueriesLive } from "./queries/booking-queries.js";
import { InventoryQueriesLive } from "./queries/inventory-queries.js";
import { PostgresBookingRepositoryLive } from "./repositories/postgres-booking.repository.js";
import { PostgresInventoryRepositoryLive } from "./repositories/postgres-inventory.repository.js";
import { PostgresTicketRepositoryLive } from "./repositories/postgres-ticket.repository.js";
import { UnitOfWorkLive } from "./repositories/unit-of-work.js";
import { AuditLogger } from "./services/audit-logger.js";
import { HealthCheck } from "./services/health-check.js";
import { ShutdownManager } from "./services/shutdown-manager.js";

// --- 1. Infrastructure Foundation ---
// These provide the base tags: SqlClient and EventBus
const CoreLive = Layer.mergeAll(ConnectionPoolLive, EventBus.Live);

// --- 2. Base Infrastructure Services ---
// These depend on Core (Database) and provide: AuditLogger, HealthCheck, ShutdownManager
const ServicesLive = Layer.mergeAll(
  AuditLogger.Live,
  HealthCheck.Live(),
  ShutdownManager.Live(),
).pipe(Layer.provideMerge(CoreLive));

// --- 3. Application Adapters ---
// These depend on Core + Services and provide: Repositories, Queries, Gateways, Workers
const AdaptersLive = Layer.mergeAll(
  PostgresBookingRepositoryLive,
  PostgresInventoryRepositoryLive,
  PostgresTicketRepositoryLive,
  UnitOfWorkLive,
  BookingQueriesLive,
  InventoryQueriesLive,
  CurrencyConverterGatewayLive,
  NotificationGatewayLive,
  PaymentGatewayLive,
  TransactionalOutboxLive,
  OutboxProcessorLive,
).pipe(Layer.provideMerge(ServicesLive));

// --- 4. Final Unified Layer ---
// The final InfrastructureLive layer provides ALL tags to the application layer.
// provideMerge ensures that Core and Services tags are also present in the final output.
export const InfrastructureLive = AdaptersLive;

// Re-exports for consumers
export * from "./config.js";
export { EventBus } from "./events/event-bus.js";
export { AuditLogger } from "./services/audit-logger.js";
export { HealthCheck } from "./services/health-check.js";
export { ShutdownManager } from "./services/shutdown-manager.js";
