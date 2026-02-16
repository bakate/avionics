/** biome-ignore-all lint/style/noRestrictedImports: <> */
import { createServer } from "node:http";
import {
  FetchHttpClient,
  HttpApiBuilder,
  HttpApiClient,
  HttpServer,
} from "@effect/platform";
import { NodeContext, NodeHttpServer } from "@effect/platform-node";
import { faker } from "@faker-js/faker";
import { BookingRepository } from "@workspace/application/booking.repository";
import { BookingService } from "@workspace/application/booking.service";
import {
  BookingQueries,
  type BookingQueriesPort,
} from "@workspace/application/booking-queries";
import { CancellationService } from "@workspace/application/cancellation.service";
import { InventoryRepository } from "@workspace/application/inventory.repository";
import { InventoryService } from "@workspace/application/inventory.service";
import {
  InventoryQueries,
  type InventoryQueriesPort,
} from "@workspace/application/inventory-queries";
import { NotificationGateway } from "@workspace/application/notification.gateway";
import { OutboxRepository } from "@workspace/application/outbox.repository";
import { TicketRepository } from "@workspace/application/ticket.repository";
import { UnitOfWork } from "@workspace/application/unit-of-work";
import { Booking, PnrStatus } from "@workspace/domain/booking";
import { FlightInventory, SeatBucket } from "@workspace/domain/inventory";
import {
  BookingId,
  CabinClass,
  EmailSchema,
  Money,
  makeFlightId,
  makeSegmentId,
  PassengerType,
  PnrCodeSchema,
} from "@workspace/domain/kernel";
import { Passenger, PassengerId } from "@workspace/domain/passenger";
import { BookingSegment } from "@workspace/domain/segment";
import { AuditLoggerTest } from "@workspace/infrastructure/audit-logger";
import { HealthCheckTest } from "@workspace/infrastructure/health-check";
import { PolarPaymentGatewayLive } from "@workspace/infrastructure/payment-gateway";
import {
  ConfigProvider,
  Effect,
  Layer,
  Option as O,
  Ref,
  Schema,
} from "effect";
import { describe, expect, it } from "vitest";
import { Api } from "../../api.js";
import { BookingApiLive } from "../../booking/api-live.js";
import { HealthApiLive } from "../../health/api-live.js";
import { InventoryApiLive } from "../../inventory/api-live.js";
import { MetaApiLive } from "../../meta/api-live.js";
import { WebhookApiLive } from "../../webhook/api-live.js";

const POLAR_BASE_URL = "https://sandbox-api.polar.sh";

const makePassengerEntity = (type: PassengerType = PassengerType.ADULT) =>
  new Passenger({
    id: PassengerId.make(faker.string.uuid()),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: Schema.decodeSync(EmailSchema)(faker.internet.email()),
    dateOfBirth: faker.date.birthdate(),
    gender: "MALE" as const,
    type,
  });

const BookingRepoInMemory = Layer.effect(
  BookingRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(new Map<string, Booking>());
    return BookingRepository.of({
      save: (b: Booking) =>
        Ref.update(store, (map) => new Map(map).set(b.id, b)).pipe(
          Effect.as(b),
        ),
      findById: (id: string) =>
        Ref.get(store).pipe(Effect.map((map) => O.fromNullable(map.get(id)))),
      findByPnr: (pnr: string) =>
        Ref.get(store).pipe(
          Effect.map((map) =>
            O.fromIterable([...map.values()].filter((b) => b.pnrCode === pnr)),
          ),
        ),
      findAll: () =>
        Ref.get(store).pipe(Effect.map((map) => [...map.values()])),
      findExpired: () => Effect.succeed([]),
      findByPassengerId: () => Effect.succeed([]),
    });
  }),
);

const InventoryRepoInMemory = Layer.effect(
  InventoryRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(new Map<string, FlightInventory>());
    return InventoryRepository.of({
      save: (inv: FlightInventory) =>
        Ref.update(store, (map) => new Map(map).set(inv.flightId, inv)).pipe(
          Effect.as(inv),
        ),
      getByFlightId: (id: string) =>
        Ref.get(store).pipe(
          Effect.flatMap((map) => {
            const inv = map.get(id);
            if (inv) return Effect.succeed(inv);
            return Effect.succeed(
              new FlightInventory({
                flightId: id as any,
                availability: {
                  economy: new SeatBucket({
                    available: 0,
                    capacity: 100,
                    price: Money.of(100, "EUR"),
                  }),
                  business: new SeatBucket({
                    available: 0,
                    capacity: 20,
                    price: Money.of(500, "EUR"),
                  }),
                  first: new SeatBucket({
                    available: 0,
                    capacity: 10,
                    price: Money.of(1000, "EUR"),
                  }),
                },
                version: 1,
                domainEvents: [],
              }),
            );
          }),
        ),
      findAvailableFlights: () => Effect.succeed([]),
    });
  }),
);

const TicketRepoInMemory = Layer.succeed(
  TicketRepository,
  TicketRepository.of({
    save: (t: any) => Effect.succeed(t),
    findByTicketNumber: () => Effect.succeed(O.none()),
  }),
);

const OutboxRepoInMemory = Layer.succeed(
  OutboxRepository,
  OutboxRepository.of({
    persist: () => Effect.void,
    getUnpublishedEvents: () => Effect.succeed([]),
    markAsPublished: () => Effect.void,
    markAsFailed: () => Effect.void,
  }),
);

const UnitOfWorkPassthrough = Layer.succeed(
  UnitOfWork,
  UnitOfWork.of({
    transaction: (effect: Effect.Effect<any, any, any>) => effect,
  }),
);

const NotificationGatewayMock = Layer.succeed(
  NotificationGateway,
  NotificationGateway.of({
    sendTicket: () => Effect.succeed({ messageId: "test" }),
  }),
);

const MockConfigProvider = Layer.setConfigProvider(
  ConfigProvider.fromMap(
    new Map([
      ["NODE_ENV", "development"],
      ["PORT", "0"],
      ["POLAR_API_KEY", "test_key"],
      ["POLAR_PRODUCT_ID", "test_product"],
      ["POLAR_BASE_URL", POLAR_BASE_URL],
      ["POLAR_TIMEOUT", "30"],
      ["POLAR_MAX_RETRIES", "2"],
    ]),
  ),
);

const BookingQueriesMock = Layer.succeed(BookingQueries, {
  getSummaryByPnr: () => Effect.die(new Error("Not implemented")),
  getPassengerHistory: () => Effect.die(new Error("Not implemented")),
  searchByPassengerName: () => Effect.die(new Error("Not implemented")),
  listBookings: () => Effect.die(new Error("Not implemented")),
  findExpiredBookings: () => Effect.die(new Error("Not implemented")),
} satisfies BookingQueriesPort);

const InventoryQueriesMock = Layer.succeed(InventoryQueries, {
  getFlightAvailability: () => Effect.die(new Error("Not implemented")),
  findAvailableFlights: () => Effect.die(new Error("Not implemented")),
  getInventoryStats: () => Effect.die(new Error("Not implemented")),
  getLowInventoryAlerts: () => Effect.die(new Error("Not implemented")),
  getCabinAvailability: () => Effect.die(new Error("Not implemented")),
} satisfies InventoryQueriesPort);

const makeTestLayer = () => {
  const BaseDeps = Layer.mergeAll(
    TicketRepoInMemory,
    OutboxRepoInMemory,
    UnitOfWorkPassthrough,
    NotificationGatewayMock,
    AuditLoggerTest(),
    HealthCheckTest(),
  ).pipe(Layer.provide(MockConfigProvider));

  const GatewaysLive = Layer.mergeAll(
    PolarPaymentGatewayLive,
    NotificationGatewayMock,
  ).pipe(Layer.provideMerge(BaseDeps));

  const AppServicesLive = Layer.mergeAll(
    BookingService.Live,
    CancellationService.Live,
  ).pipe(
    Layer.provideMerge(InventoryService.Live),
    Layer.provideMerge(GatewaysLive),
  );

  const HandlersLive = Layer.mergeAll(
    BookingApiLive,
    InventoryApiLive,
    HealthApiLive,
    MetaApiLive,
    WebhookApiLive,
  );

  const ApiImplementation = HttpApiBuilder.api(Api).pipe(
    Layer.provide(HandlersLive),
    Layer.provide(AppServicesLive),
    Layer.provideMerge(BookingQueriesMock),
    Layer.provideMerge(InventoryQueriesMock),
  );

  const ServerLive = NodeHttpServer.layer(createServer, { port: 0 }).pipe(
    Layer.provide(Layer.mergeAll(MockConfigProvider, NodeContext.layer)),
  );

  return Layer.mergeAll(
    HttpApiBuilder.serve().pipe(
      Layer.provide(ApiImplementation),
      Layer.provide(ServerLive),
    ),
    ServerLive,
    FetchHttpClient.layer,
  ).pipe(
    Layer.provideMerge(BookingRepoInMemory),
    Layer.provideMerge(InventoryRepoInMemory),
  );
};

describe("Booking API Integration (Multi-Passenger)", () => {
  it("should cancel a multi-passenger booking", async () => {
    const bookingId = BookingId.make(faker.string.uuid());
    const pnr = `PNR${faker.string.alphanumeric(3).toUpperCase()}`;

    const segment = new BookingSegment({
      id: makeSegmentId(faker.string.uuid()),
      flightId: makeFlightId("FL-123"),
      cabin: CabinClass.ECONOMY,
      price: Money.of(175, "EUR"),
      seatNumber: O.none(),
    });

    const program = Effect.gen(function* () {
      const repo = yield* BookingRepository;
      const initialBooking = Booking.create({
        id: bookingId,
        pnrCode: PnrCodeSchema.make(pnr),
        passengers: [
          makePassengerEntity(PassengerType.ADULT),
          makePassengerEntity(PassengerType.CHILD),
          makePassengerEntity(PassengerType.INFANT),
        ],
        segments: [segment],
        expiresAt: O.none(),
      }).clearEvents();
      yield* repo.save(initialBooking);

      const server = yield* HttpServer.HttpServer;
      const port =
        server.address._tag === "TcpAddress" ? server.address.port : 0;
      const client = yield* HttpApiClient.make(Api, {
        baseUrl: `http://localhost:${port}`,
      });

      const response = yield* client.bookings.cancel({
        path: { id: bookingId },
        payload: { reason: faker.lorem.sentence() },
      });

      expect(response.status).toBe("Cancelled");
      expect(response.id).toBe(bookingId);
      expect(response.passengers).toHaveLength(3);

      const updated = yield* repo.findById(bookingId);
      expect(O.getOrThrow(updated).status).toBe(PnrStatus.CANCELLED);
    });

    await Effect.runPromise(
      program.pipe(Effect.provide(makeTestLayer()), Effect.scoped),
    );
  });

  it("should list multi-passenger bookings with correct passenger data", async () => {
    const bookingId = BookingId.make(faker.string.uuid());
    const pnr = `LST${faker.string.alphanumeric(3).toUpperCase()}`;

    const segment = new BookingSegment({
      id: makeSegmentId(faker.string.uuid()),
      flightId: makeFlightId("FL-456"),
      cabin: CabinClass.BUSINESS,
      price: Money.of(950, "EUR"),
      seatNumber: O.none(),
    });

    const program = Effect.gen(function* () {
      const repo = yield* BookingRepository;
      const booking = Booking.create({
        id: bookingId,
        pnrCode: PnrCodeSchema.make(pnr),
        passengers: [
          makePassengerEntity(PassengerType.ADULT),
          makePassengerEntity(PassengerType.SENIOR),
        ],
        segments: [segment],
        expiresAt: O.none(),
      }).clearEvents();
      yield* repo.save(booking);

      const server = yield* HttpServer.HttpServer;
      const port =
        server.address._tag === "TcpAddress" ? server.address.port : 0;
      const client = yield* HttpApiClient.make(Api, {
        baseUrl: `http://localhost:${port}`,
      });

      const bookings = yield* client.bookings.list();

      expect(bookings.length).toBeGreaterThanOrEqual(1);
      const found = bookings.find((b) => b.id === bookingId);
      expect(found).toBeDefined();
      expect(found!.passengers).toHaveLength(2);
      expect(found!.passengers[0].type).toBe(PassengerType.ADULT);
      expect(found!.passengers[1].type).toBe(PassengerType.SENIOR);
    });

    await Effect.runPromise(
      program.pipe(Effect.provide(makeTestLayer()), Effect.scoped),
    );
  });
});
