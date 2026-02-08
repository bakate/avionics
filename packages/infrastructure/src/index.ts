import { Layer } from "effect";
import { ConnectionPoolLive } from "./db/connection.js";
import { EventBus } from "./events/event-bus.js";
import { OutboxProcessorLive } from "./events/outbox-processor.js";
import { TransactionalOutboxLive } from "./events/transactional-outbox.js";
import { HttpCurrencyConverterGateway } from "./gateways/currency-converter.gateway.js";
import { ResendNotificationGateway } from "./gateways/notification-gateway.js";
import { PolarPaymentGateway } from "./gateways/payment-gateway.js";
import { PostgresBookingQueries } from "./queries/booking-queries.js";
import { PostgresInventoryQueries } from "./queries/inventory-queries.js";
import { PostgresBookingRepository } from "./repositories/postgres-booking.repository.js";
import { PostgresInventoryRepository } from "./repositories/postgres-inventory.repository.js";
import { PostgresTicketRepository } from "./repositories/postgres-ticket.repository.js";
import { PostgresUnitOfWork } from "./repositories/unit-of-work.js";
import { AuditLogger } from "./services/audit-logger.js";
import { HealthCheck } from "./services/health-check.js";
import { ShutdownManager } from "./services/shutdown-manager.js";

// --- 1. Infrastructure Foundation ---
// These provide the base tags: SqlClient and EventBus
const CoreLive = Layer.merge(ConnectionPoolLive, EventBus.Live);

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
  PostgresBookingRepository.Live,
  PostgresInventoryRepository.Live,
  PostgresTicketRepository.Live,
  PostgresUnitOfWork.Live,
  PostgresBookingQueries.Live,
  PostgresInventoryQueries.Live,
  HttpCurrencyConverterGateway.Live,
  ResendNotificationGateway.Live,
  PolarPaymentGateway.Live,
  TransactionalOutboxLive,
  OutboxProcessorLive,
).pipe(Layer.provideMerge(ServicesLive));

// --- 4. Final Unified Layer ---
// The final InfrastructureLive layer provides ALL tags to the application layer.
// provideMerge ensures that Core and Services tags are also present in the final output.
export const InfrastructureLive = AdaptersLive;
