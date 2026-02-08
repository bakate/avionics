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
import { Deferred, Duration, Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  AuditLogger,
  EventBus,
  HealthCheck,
  InfrastructureLive,
  ShutdownManager,
} from "../../index.js";

describe("Infrastructure Composition Integration", () => {
  it("should resolve all essential services from the InfrastructureLive layer", async () => {
    const program = Effect.gen(function* () {
      // Repositories
      const bookingRepo = yield* BookingRepository;
      const inventoryRepo = yield* InventoryRepository;
      const ticketRepo = yield* TicketRepository;
      const uow = yield* UnitOfWork;

      // Queries
      const bookingQueries = yield* BookingQueries;
      const inventoryQueries = yield* InventoryQueries;

      // Gateways
      const currencyGateway = yield* CurrencyConverterGateway;
      const notificationGateway = yield* NotificationGateway;
      const paymentGateway = yield* PaymentGateway;

      // Services
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

    // Explicitly providing the layer and running the promise
    // If the Context is not 'never' after provide, it's a type error
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(InfrastructureLive)),
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
    // The outbox processor starts a fiber in a polling loop when provided.
    // We verify it by inserting a record and waiting for it to be published to the EventBus.
    const program = Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const eventBus = yield* EventBus;
      const deferred = yield* Deferred.make<string>();

      // 1. Subscribe to a test event
      yield* eventBus.subscribe("OutboxTestEvent", (event: any) =>
        Deferred.succeed(deferred, event.data),
      );

      // 2. Insert into outbox manually
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

      // 3. Wait for the processor to pick it up (polling is 5s)
      const result = yield* Deferred.await(deferred).pipe(
        Effect.timeout(Duration.seconds(10)),
        Effect.catchAll(() => Effect.succeed("timeout")),
      );

      return result;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(InfrastructureLive)),
    );

    expect(result).toBe("processed");
  });
});
