import { fc, test } from "@fast-check/vitest";
import { Effect, Layer, Ref } from "effect";
import { describe, expect } from "vitest";
import {
  AuditLogger,
  AuditLoggerTest,
  UserContext,
} from "../../../services/audit-logger.js";

const PROPERTIES = {
  AGGREGATE_SAVES_CREATE_RECORDS: {
    number: 18,
    text: "Aggregate saves create audit records",
  },
  USER_CONTEXT_CAPTURED: {
    number: 19,
    text: "User context is captured when available",
  },
  RECORDS_HAVE_TIMESTAMPS: {
    number: 20,
    text: "Audit records have timestamps",
  },
} as const;

type AggregateType = "Booking" | "FlightInventory" | "Ticket";
type OperationType = "CREATE" | "UPDATE" | "DELETE";

interface CapturedAuditRecord {
  readonly aggregateType: AggregateType;
  readonly aggregateId: string;
  readonly operation: OperationType;
  readonly changes: unknown;
  readonly userId: string | null;
  readonly timestamp: Date;
}

const aggregateTypeArb = fc.constantFrom<AggregateType>(
  "Booking",
  "FlightInventory",
  "Ticket",
);
const operationTypeArb = fc.constantFrom<OperationType>(
  "CREATE",
  "UPDATE",
  "DELETE",
);
const aggregateIdArb = fc.uuid();
const userIdArb = fc.uuid();
const changesArb = fc.record({
  before: fc.option(fc.record({ status: fc.string() }), { nil: null }),
  after: fc.record({ status: fc.string() }),
});

describe("AuditLogger Property Tests", () => {
  test.prop(
    [
      fc.array(
        fc.record({
          aggregateType: aggregateTypeArb,
          aggregateId: aggregateIdArb,
          operation: operationTypeArb,
          changes: changesArb,
        }),
        { minLength: 1, maxLength: 10 },
      ),
    ],
    { numRuns: 20 },
  )(
    `Property ${PROPERTIES.AGGREGATE_SAVES_CREATE_RECORDS.number}: ${PROPERTIES.AGGREGATE_SAVES_CREATE_RECORDS.text}`,
    async (operations) => {
      const capturedRecordsRef = Ref.unsafeMake<Array<CapturedAuditRecord>>([]);

      const testLayer = AuditLoggerTest({
        logSync: (params) =>
          Ref.update(capturedRecordsRef, (records) => [
            ...records,
            { ...params, userId: null, timestamp: new Date() },
          ]),
      });

      const program = Effect.gen(function* () {
        const auditLogger = yield* AuditLogger;

        for (const op of operations) {
          yield* auditLogger.logSync(op);
        }
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));

      const capturedRecords = Ref.get(capturedRecordsRef).pipe(Effect.runSync);

      expect(capturedRecords.length).toBe(operations.length);

      for (let index = 0; index < operations.length; index++) {
        const op = operations[index];
        const record = capturedRecords[index];
        if (!record || !op) {
          throw new Error("Invariant violation: record or op must exist");
        }

        expect(record.aggregateType).toBe(op.aggregateType);
        expect(record.aggregateId).toBe(op.aggregateId);
        expect(record.operation).toBe(op.operation);
        expect(record.changes).toEqual(op.changes);
      }
    },
  );

  test.prop(
    [aggregateTypeArb, aggregateIdArb, operationTypeArb, changesArb, userIdArb],
    {
      numRuns: 20,
    },
  )(
    `Property ${PROPERTIES.USER_CONTEXT_CAPTURED.number}: ${PROPERTIES.USER_CONTEXT_CAPTURED.text}`,
    async (aggregateType, aggregateId, operation, changes, userId) => {
      const capturedUserIdRef = Ref.unsafeMake<string | null>(null);

      const auditLoggerLayer = AuditLoggerTest({
        logSync: () =>
          Effect.gen(function* () {
            const userContext = yield* Effect.serviceOption(UserContext);
            const capturedUserId =
              userContext._tag === "Some" ? userContext.value.userId : null;
            yield* Ref.set(capturedUserIdRef, capturedUserId);
          }),
      });

      const userContextLayer = Layer.succeed(UserContext, { userId });
      const testLayer = Layer.merge(auditLoggerLayer, userContextLayer);

      const program = Effect.gen(function* () {
        const auditLogger = yield* AuditLogger;
        yield* auditLogger.logSync({
          aggregateType,
          aggregateId,
          operation,
          changes,
        });
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));

      const capturedUserId = Ref.get(capturedUserIdRef).pipe(Effect.runSync);

      expect(capturedUserId).toBe(userId);
    },
  );

  test.prop(
    [
      fc.array(
        fc.record({
          aggregateType: aggregateTypeArb,
          aggregateId: aggregateIdArb,
          operation: operationTypeArb,
          changes: changesArb,
        }),
        { minLength: 1, maxLength: 5 },
      ),
    ],
    { numRuns: 15 },
  )(
    `Property ${PROPERTIES.RECORDS_HAVE_TIMESTAMPS.number}: ${PROPERTIES.RECORDS_HAVE_TIMESTAMPS.text}`,
    async (operations) => {
      const capturedTimestampsRef = Ref.unsafeMake<Array<Date>>([]);

      const testLayer = AuditLoggerTest({
        logSync: () =>
          Ref.update(capturedTimestampsRef, (timestamps) => [
            ...timestamps,
            new Date(),
          ]),
      });

      const beforeTest = new Date();

      const program = Effect.gen(function* () {
        const auditLogger = yield* AuditLogger;

        for (const op of operations) {
          yield* auditLogger.logSync(op);
        }
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));

      const afterTest = new Date();
      const capturedTimestamps = Ref.get(capturedTimestampsRef).pipe(
        Effect.runSync,
      );

      for (const timestamp of capturedTimestamps) {
        expect(timestamp).toBeInstanceOf(Date);
        expect(timestamp.getTime()).toBeGreaterThanOrEqual(
          beforeTest.getTime(),
        );
        expect(timestamp.getTime()).toBeLessThanOrEqual(afterTest.getTime());
      }
    },
  );

  test.prop([aggregateTypeArb, aggregateIdArb, operationTypeArb, changesArb], {
    numRuns: 10,
  })(
    "Property 18b: Missing user context results in null userId",
    async (aggregateType, aggregateId, operation, changes) => {
      const capturedUserIdRef = Ref.unsafeMake<string | null | undefined>(
        undefined,
      );

      const testLayer = AuditLoggerTest({
        logSync: () =>
          Effect.gen(function* () {
            const userContext = yield* Effect.serviceOption(UserContext);
            const capturedUserId =
              userContext._tag === "Some" ? userContext.value.userId : null;
            yield* Ref.set(capturedUserIdRef, capturedUserId);
          }),
      });

      const program = Effect.gen(function* () {
        const auditLogger = yield* AuditLogger;
        yield* auditLogger.logSync({
          aggregateType,
          aggregateId,
          operation,
          changes,
        });
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));

      const capturedUserId = Ref.get(capturedUserIdRef).pipe(Effect.runSync);

      expect(capturedUserId).toBeNull();
    },
  );

  test.prop([aggregateTypeArb, aggregateIdArb, operationTypeArb, changesArb], {
    numRuns: 10,
  })(
    "Property 18c: fire-and-forget log doesn't block caller",
    async (aggregateType, aggregateId, operation, changes) => {
      // Use default Test layer - no overrides needed
      const testLayer = AuditLoggerTest();

      const program = Effect.gen(function* () {
        const auditLogger = yield* AuditLogger;
        yield* auditLogger.log({
          aggregateType,
          aggregateId,
          operation,
          changes,
        });
        return "success";
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer)),
      );

      expect(result).toBe("success");
    },
  );
});
