import { SqlClient } from "@effect/sql";
import { BookingRepository } from "@workspace/application/booking.repository";
import { BookingQueries } from "@workspace/application/booking-queries";
import { CurrencyConverterGateway } from "@workspace/application/currency-converter.gateway";
import { InventoryRepository } from "@workspace/application/inventory.repository";
import { InventoryQueries } from "@workspace/application/inventory-queries";
import { NotificationGateway } from "@workspace/application/notification.gateway";
import { PaymentGateway } from "@workspace/application/payment.gateway";
import { TicketRepository } from "@workspace/application/ticket.repository";
import { UnitOfWork } from "@workspace/application/unit-of-work";
import { ConfigProvider, Deferred, Duration, Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { EventBus } from "../../events/event-bus.js";
import { InfrastructureLive } from "../../index.js";
import { AuditLogger } from "../../services/audit-logger.js";
import { HealthCheck } from "../../services/health-check.js";
import { ShutdownManager } from "../../services/shutdown-manager.js";

describe("Infrastructure Composition Integration", () => {
  it("should resolve all essential services from the InfrastructureLive layer", async () => {
    const program = Effect.gen(function* () {
      const bookingRepo = yield* BookingRepository;
      const inventoryRepo = yield* InventoryRepository;
      const ticketRepo = yield* TicketRepository;
      const uow = yield* UnitOfWork;
      const bookingQueries = yield* BookingQueries;
      const inventoryQueries = yield* InventoryQueries;
      const currencyGateway = yield* CurrencyConverterGateway;
      const notificationGateway = yield* NotificationGateway;
      const paymentGateway = yield* PaymentGateway;
      const auditLogger = yield* AuditLogger;
      const healthCheck = yield* HealthCheck;
      const shutdownManager = yield* ShutdownManager;

      return {
        bookingRepo,
        inventoryRepo,
        ticketRepo,
        uow,
        bookingQueries,
        inventoryQueries,
        currencyGateway,
        notificationGateway,
        paymentGateway,
        auditLogger,
        healthCheck,
        shutdownManager,
      };
    });

    // We satisfy all requirements including Scope (required by Outbox/EventBus) and Config
    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(InfrastructureLive),
        Effect.provide(
          Layer.setConfigProvider(ConfigProvider.fromMap(new Map())),
        ),
        Effect.scoped,
      ) as Effect.Effect<any, any, never>,
    );

    expect(result.bookingRepo).toBeDefined();
    expect(result.inventoryRepo).toBeDefined();
    expect(result.ticketRepo).toBeDefined();
    expect(result.uow).toBeDefined();
    expect(result.bookingQueries).toBeDefined();
    expect(result.inventoryQueries).toBeDefined();
    expect(result.currencyGateway).toBeDefined();
    expect(result.notificationGateway).toBeDefined();
    expect(result.paymentGateway).toBeDefined();
    expect(result.auditLogger).toBeDefined();
    expect(result.healthCheck).toBeDefined();
    expect(result.shutdownManager).toBeDefined();
  });

  it("should verify that the outbox processor is running and processing events", async () => {
    const program = Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const eventBus = yield* EventBus;
      const deferred = yield* Deferred.make<string>();

      yield* eventBus.subscribe("OutboxTestEvent", (event: unknown) =>
        Deferred.succeed(deferred, (event as { readonly data: string }).data),
      );

      const eventId = crypto.randomUUID();
      yield* sql`
        INSERT INTO event_outbox (id, event_type, payload, aggregate_id, created_at)
        VALUES (
          ${eventId},
          'OutboxTestEvent',
          ${JSON.stringify({ _tag: "OutboxTestEvent", data: "processed" })},
          'test-aggregate',
          NOW()
        )
      `;

      const result = yield* Deferred.await(deferred).pipe(
        Effect.timeout(Duration.seconds(30)),
        Effect.catchAll(() => Effect.succeed("timeout")),
      );

      return result;
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(InfrastructureLive),
        Effect.provide(
          Layer.setConfigProvider(
            ConfigProvider.fromMap(new Map([["OUTBOX_POLLING_INTERVAL", "1"]])),
          ),
        ),
        Effect.scoped,
      ) as Effect.Effect<string, unknown, never>,
    );

    expect(result).toBe("processed");
  });
});
