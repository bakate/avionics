import { Layer } from "effect";
import { ConnectionPoolLive } from "./db/connection.js";
import { EventBusLive } from "./events/event-bus.js";
import { TransactionalOutboxLive } from "./events/transactional-outbox.js";
import { CurrencyConverterGatewayLive } from "./gateways/currency-converter.gateway.js";
import { NotificationGatewayLive } from "./gateways/notification-gateway.js";
import { PaymentGatewayLive } from "./gateways/payment-gateway.js";
import { PostgresBookingRepositoryLive } from "./repositories/postgres-booking.repository.js";
import { PostgresInventoryRepositoryLive } from "./repositories/postgres-inventory.repository.js";
import { UnitOfWorkLive } from "./repositories/unit-of-work.js";

// Grouping Repositories
export const RepositoriesLive = Layer.mergeAll(
  PostgresBookingRepositoryLive,
  PostgresInventoryRepositoryLive,
  UnitOfWorkLive,
);

// Grouping Gateways
export const GatewaysLive = Layer.mergeAll(
  CurrencyConverterGatewayLive,
  NotificationGatewayLive,
  PaymentGatewayLive,
);

// Foundation (DB)
export const DatabaseLive = ConnectionPoolLive;

// Full Infrastructure Layer
export const InfrastructureLive = Layer.mergeAll(
  RepositoriesLive,
  GatewaysLive,
  EventBusLive,
  TransactionalOutboxLive,
).pipe(Layer.provide(DatabaseLive));

export * from "./config.js";
