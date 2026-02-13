import {
  type FlightFullError,
  type FlightNotFoundError,
  type InvalidAmountError,
  type InventoryOvercapacityError,
  type InventoryPersistenceError,
  type OptimisticLockingError,
} from "@workspace/domain/errors";
import { FlightInventory, SeatBucket } from "@workspace/domain/inventory";
import {
  type CabinClass,
  type FlightId,
  Money,
} from "@workspace/domain/kernel";
import {
  ConfigProvider,
  Context,
  Deferred,
  Duration,
  Effect,
  Layer,
  Metric,
  MetricBoundaries,
  Queue,
  Schedule,
} from "effect";
import { HoldSeatsResult, ReleaseSeatsResult } from "../models/results.js";
import {
  InventoryRepository,
  type InventoryRepositoryPort,
} from "../repositories/inventory.repository.js";

// ============================================================================
// TYPES
// ============================================================================

export type HoldSeatsInput = {
  flightId: FlightId;
  cabin: CabinClass;
  numberOfSeats: number;
};

export type HoldError =
  | FlightFullError
  | FlightNotFoundError
  | OptimisticLockingError
  | InvalidAmountError
  | InventoryPersistenceError;

export type ReleaseError =
  | FlightNotFoundError
  | OptimisticLockingError
  | InvalidAmountError
  | InventoryOvercapacityError
  | InventoryPersistenceError;

type HoldRequest = {
  type: "hold";
  params: HoldSeatsInput;
  deferred: Deferred.Deferred<HoldSeatsResult, HoldError>;
};

type ReleaseRequest = {
  type: "release";
  params: HoldSeatsInput;
  deferred: Deferred.Deferred<ReleaseSeatsResult, ReleaseError>;
};

type InventoryRequest = HoldRequest | ReleaseRequest;

type PendingAction = () => Effect.Effect<void>;

// ============================================================================
// METRICS
// ============================================================================

const holdSeatsCounter = Metric.counter("inventory_hold_seats_total", {
  description: "Total number of hold seat requests",
});

const holdSeatsSuccessCounter = Metric.counter(
  "inventory_hold_seats_success_total",
  { description: "Successful hold seat requests" },
);

const holdSeatsFailureCounter = Metric.counter(
  "inventory_hold_seats_failure_total",
  { description: "Failed hold seat requests" },
);

const holdLatencyHistogram = Metric.histogram(
  "inventory_hold_latency_ms",
  MetricBoundaries.fromIterable([
    10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120,
  ]),
);

const batchSizeHistogram = Metric.histogram(
  "inventory_batch_size",
  MetricBoundaries.fromIterable([1, 2, 3, 4, 5, 10, 15, 20]),
);

const queueDepthGauge = Metric.gauge("inventory_queue_depth", {
  description: "Current depth of the request queue",
});

// ============================================================================
// TYPE GUARDS
// ============================================================================

const isOptimisticLockingError = (
  error: unknown,
): error is OptimisticLockingError =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  error._tag === "OptimisticLockingError";

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Process hold request logic and accumulate pending actions.
 */
const processHoldRequest = (
  req: HoldRequest,
  inventory: FlightInventory,
  pendingActions: Array<PendingAction>,
): Effect.Effect<FlightInventory, never> =>
  inventory.holdSeats(req.params.cabin, req.params.numberOfSeats).pipe(
    Effect.matchEffect({
      onFailure: (error: HoldError) =>
        Effect.sync(() => {
          pendingActions.push(() =>
            Deferred.fail(req.deferred, error).pipe(
              Effect.tap(() => Metric.increment(holdSeatsFailureCounter)),
              Effect.asVoid,
            ),
          );
          return inventory;
        }),
      onSuccess: ([nextInv, unitPrice]) =>
        Effect.sync(() => {
          pendingActions.push(() => {
            const result = new HoldSeatsResult({
              inventory: nextInv,
              totalPrice: unitPrice.multiply(req.params.numberOfSeats),
              unitPrice,
              seatsHeld: req.params.numberOfSeats,
              holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
            });
            return Deferred.succeed(req.deferred, result).pipe(
              Effect.tap(() => Metric.increment(holdSeatsSuccessCounter)),
              Effect.asVoid,
            );
          });
          return nextInv;
        }),
    }),
  );

/**
 * Process release request logic and accumulate pending actions.
 */
const processReleaseRequest = (
  req: ReleaseRequest,
  inventory: FlightInventory,
  pendingActions: Array<PendingAction>,
): Effect.Effect<FlightInventory, never> =>
  inventory.releaseSeats(req.params.cabin, req.params.numberOfSeats).pipe(
    Effect.matchEffect({
      onFailure: (error: ReleaseError) =>
        Effect.sync(() => {
          pendingActions.push(() =>
            Deferred.fail(req.deferred, error).pipe(Effect.asVoid),
          );
          return inventory;
        }),
      onSuccess: (nextInv) =>
        Effect.sync(() => {
          pendingActions.push(() => {
            const result = new ReleaseSeatsResult({
              inventory: nextInv,
              seatsReleased: req.params.numberOfSeats,
            });
            return Deferred.succeed(req.deferred, result).pipe(Effect.asVoid);
          });
          return nextInv;
        }),
    }),
  );

/**
 * Process all requests in a batch, updating inventory sequentially.
 */
const processBatchLogic = (
  flightId: FlightId,
  requests: Array<InventoryRequest>,
  repo: InventoryRepositoryPort,
): Effect.Effect<Array<PendingAction>, HoldError | ReleaseError> =>
  Effect.gen(function* () {
    let inventory = yield* repo.getByFlightId(flightId);
    const pendingActions: Array<PendingAction> = [];
    let dirty = false;

    for (const req of requests) {
      const nextInventory =
        req.type === "hold"
          ? yield* processHoldRequest(req, inventory, pendingActions)
          : yield* processReleaseRequest(req, inventory, pendingActions);

      if (nextInventory !== inventory) {
        inventory = nextInventory;
        dirty = true;
      }
    }

    if (dirty) {
      yield* repo.save(inventory);
    }

    return pendingActions;
  });

/**
 * Process a batch of requests for a single flight with retry logic.
 */
const processFlightBatch = (
  flightId: FlightId,
  requests: Array<InventoryRequest>,
  repo: InventoryRepositoryPort,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Metric.update(batchSizeHistogram, requests.length);

    const retryPolicy = Schedule.exponential(Duration.millis(10)).pipe(
      Schedule.jittered,
      Schedule.intersect(Schedule.recurs(10)),
      Schedule.whileInput(isOptimisticLockingError),
    );

    const processWithRetry = processBatchLogic(flightId, requests, repo).pipe(
      Effect.retry(retryPolicy),
    );

    return yield* processWithRetry.pipe(
      Effect.flatMap((actions) =>
        Effect.forEach(actions, (action) => action(), { discard: true }),
      ),
      Effect.catchAll((error: HoldError | ReleaseError) =>
        Effect.forEach(
          requests,
          (req) =>
            Deferred.fail(
              req.deferred as unknown as Deferred.Deferred<
                unknown,
                HoldError | ReleaseError
              >,
              error,
            ),
          { discard: true },
        ),
      ),
    );
  });

/**
 * Main batch processor that continuously processes queued requests.
 */
const processBatches = (
  queue: Queue.Queue<InventoryRequest>,
  repo: InventoryRepositoryPort,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    while (true) {
      const batch = yield* Queue.takeBetween(queue, 1, 50);
      yield* Metric.set(queueDepthGauge, yield* Queue.size(queue));

      if (batch.length > 0) {
        // Group requests by flightId
        const byFlight = new Map<string, Array<InventoryRequest>>();
        for (const req of batch) {
          const key = req.params.flightId;
          const existing = byFlight.get(key) ?? [];
          existing.push(req);
          byFlight.set(key, existing);
        }

        // Process each flight's batch in parallel
        yield* Effect.forEach(
          Array.from(byFlight.entries()),
          ([flightId, flightRequests]) =>
            processFlightBatch(flightId as FlightId, flightRequests, repo),
          { concurrency: "unbounded" },
        );
      }
    }
  }).pipe(Effect.forever);

// ============================================================================
// DIRECT PROCESSING (FALLBACK)
// ============================================================================

/**
 * Direct hold operation with retry (fallback when queue is full).
 */
const holdSeatsDirect = (
  params: HoldSeatsInput,
  repo: InventoryRepositoryPort,
  retryPolicy: Schedule.Schedule<unknown, HoldError>,
): Effect.Effect<HoldSeatsResult, HoldError> =>
  Effect.gen(function* () {
    const inventory = yield* repo.getByFlightId(params.flightId);
    const [nextInventory, unitPrice] = yield* inventory.holdSeats(
      params.cabin,
      params.numberOfSeats,
    );
    const savedInventory = yield* repo.save(nextInventory);
    const totalPrice = unitPrice.multiply(params.numberOfSeats);

    yield* Metric.increment(holdSeatsSuccessCounter);

    return new HoldSeatsResult({
      inventory: savedInventory,
      totalPrice,
      unitPrice,
      seatsHeld: params.numberOfSeats,
      holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
  }).pipe(
    Effect.retry(retryPolicy),
    Effect.tapError(() => Metric.increment(holdSeatsFailureCounter)),
  );

/**
 * Direct release operation with retry (fallback when queue is full).
 */
const releaseSeatsDirect = (
  params: HoldSeatsInput,
  repo: InventoryRepositoryPort,
  retryPolicy: Schedule.Schedule<unknown, ReleaseError>,
): Effect.Effect<ReleaseSeatsResult, ReleaseError> =>
  Effect.gen(function* () {
    const inventory = yield* repo.getByFlightId(params.flightId);
    const nextInventory = yield* inventory.releaseSeats(
      params.cabin,
      params.numberOfSeats,
    );
    const savedInventory = yield* repo.save(nextInventory);

    return new ReleaseSeatsResult({
      inventory: savedInventory,
      seatsReleased: params.numberOfSeats,
    });
  }).pipe(Effect.retry(retryPolicy));

// ============================================================================
// SERVICE INTERFACE & IMPLEMENTATION
// ============================================================================

export interface InventoryServiceSignature {
  holdSeats: (
    input: HoldSeatsInput,
  ) => Effect.Effect<HoldSeatsResult, HoldError>;
  releaseSeats: (
    input: HoldSeatsInput,
  ) => Effect.Effect<ReleaseSeatsResult, ReleaseError>;
  getAvailability: (
    flightId: FlightId,
  ) => Effect.Effect<
    FlightInventory,
    FlightNotFoundError | InventoryPersistenceError
  >;
}

export class InventoryService extends Context.Tag("InventoryService")<
  InventoryService,
  InventoryServiceSignature
>() {
  /**
   * Live Layer — Production implementation with batching and optimized retry.
   */
  static readonly Live = Layer.scoped(
    InventoryService,
    Effect.gen(function* () {
      const repo = yield* InventoryRepository;
      const queue = yield* Queue.bounded<InventoryRequest>(500);

      // Fork batch processor as a scoped daemon
      yield* Effect.forkScoped(
        processBatches(queue, repo).pipe(
          Effect.retry(Schedule.fixed(Duration.seconds(1))),
          Effect.catchAllCause((cause) =>
            Effect.log(`[Service] Batch processor crashed: ${cause}`),
          ),
        ),
      );

      yield* Effect.log(
        "[Service] Inventory service initialized with Single-Queue Batching",
      );

      // Retry policy for direct fallback operations
      const directRetryPolicy = Schedule.exponential(Duration.millis(5)).pipe(
        Schedule.jittered,
        Schedule.intersect(Schedule.recurs(10)),
        Schedule.whileInput(isOptimisticLockingError),
      ) as Schedule.Schedule<unknown, HoldError | ReleaseError>;

      return {
        holdSeats: (params: HoldSeatsInput) =>
          Effect.gen(function* () {
            const startTime = Date.now();
            yield* Metric.increment(holdSeatsCounter);
            const deferred = yield* Deferred.make<HoldSeatsResult, HoldError>();

            const offered = yield* Queue.offer(queue, {
              type: "hold",
              params,
              deferred,
            });

            if (!offered) {
              return yield* holdSeatsDirect(params, repo, directRetryPolicy);
            }

            const result = yield* Deferred.await(deferred);
            yield* Metric.update(holdLatencyHistogram, Date.now() - startTime);
            return result;
          }),

        releaseSeats: (params: HoldSeatsInput) =>
          Effect.gen(function* () {
            const deferred = yield* Deferred.make<
              ReleaseSeatsResult,
              ReleaseError
            >();

            const offered = yield* Queue.offer(queue, {
              type: "release",
              params,
              deferred,
            });

            if (!offered) {
              return yield* releaseSeatsDirect(params, repo, directRetryPolicy);
            }

            return yield* Deferred.await(deferred);
          }),

        getAvailability: (flightId: FlightId) => repo.getByFlightId(flightId),
      };
    }),
  ).pipe(
    Layer.provide(Layer.setConfigProvider(ConfigProvider.fromMap(new Map()))),
  );

  /**
   * Helper to create mock inventory for tests.
   */
  private static makeMockInventory = (
    flightId: FlightId,
    economySeats = 10,
  ): FlightInventory =>
    new FlightInventory({
      flightId,
      availability: {
        economy: new SeatBucket({
          available: economySeats,
          capacity: 100,
          price: Money.of(500, "EUR"),
        }),
        business: new SeatBucket({
          available: 5,
          capacity: 50,
          price: Money.of(1000, "USD"),
        }),
        first: new SeatBucket({
          available: 2,
          capacity: 20,
          price: Money.of(2000, "USD"),
        }),
      },
      version: 1,
      domainEvents: [],
    });

  /**
   * Test Layer — Factory for tests (no batching, immediate execution).
   */
  static readonly Test = (
    overrides: Partial<InventoryServiceSignature> = {},
  ): Layer.Layer<InventoryService> =>
    Layer.succeed(
      InventoryService,
      InventoryService.of({
        holdSeats: ({ flightId, cabin, numberOfSeats }) =>
          Effect.gen(function* () {
            const inventory = InventoryService.makeMockInventory(flightId);
            const [nextInventory, unitPrice] = yield* inventory.holdSeats(
              cabin,
              numberOfSeats,
            );
            return new HoldSeatsResult({
              inventory: nextInventory,
              totalPrice: unitPrice.multiply(numberOfSeats),
              unitPrice,
              seatsHeld: numberOfSeats,
              holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
            });
          }),
        getAvailability: (flightId) =>
          Effect.succeed(InventoryService.makeMockInventory(flightId)),
        releaseSeats: ({ flightId, cabin, numberOfSeats }) =>
          Effect.gen(function* () {
            const inventory = InventoryService.makeMockInventory(flightId);
            const nextInventory = yield* inventory.releaseSeats(
              cabin,
              numberOfSeats,
            );
            return new ReleaseSeatsResult({
              inventory: nextInventory,
              seatsReleased: numberOfSeats,
            });
          }),
        ...overrides,
      }),
    );
}
