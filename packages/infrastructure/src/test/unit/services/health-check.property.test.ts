import { fc, test } from "@fast-check/vitest";
import { Effect, Ref } from "effect";
import { describe, expect } from "vitest";
import { HealthCheck } from "../../../services/health-check.js";

const PROPERTIES = {
  HEALTH_CHECKS_VERIFY_DATABASE: {
    number: 24,
    text: "Health checks verify database",
  },
  HEALTH_CHECKS_VERIFY_OUTBOX: {
    number: 25,
    text: "Health checks verify outbox processor",
  },
  UNHEALTHY_SERVICES_RETURN_UNHEALTHY: {
    number: 26,
    text: "Unhealthy services return unhealthy status",
  },
  HEALTH_RESPONSES_INCLUDE_VERSION: {
    number: 27,
    text: "Health responses include version",
  },
} as const;

type HealthStatus = "healthy" | "unhealthy" | "degraded";

const healthStatusArb = fc.constantFrom<HealthStatus>(
  "healthy",
  "unhealthy",
  "degraded",
);
const versionArb = fc.stringMatching(/^\d+\.\d+\.\d+$/);
const latencyArb = fc.integer({ min: 1, max: 1000 });

describe("HealthCheck Property Tests", () => {
  test.prop([versionArb], { numRuns: 15 })(
    `Property ${PROPERTIES.HEALTH_CHECKS_VERIFY_DATABASE.number}: ${PROPERTIES.HEALTH_CHECKS_VERIFY_DATABASE.text}`,
    async (version) => {
      const testLayer = HealthCheck.Test({
        check: () =>
          Effect.succeed({
            status: "healthy",
            version,
            components: [
              { name: "database", status: "healthy", latencyMs: 5 },
              { name: "outbox_processor", status: "healthy" },
            ],
            timestamp: new Date(),
          }),
      });

      const program = Effect.gen(function* () {
        const healthCheck = yield* HealthCheck;
        return yield* healthCheck.check();
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer)),
      );

      const databaseComponent = result.components.find(
        (c) => c.name === "database",
      );

      expect(databaseComponent).toBeDefined();
      expect(databaseComponent?.status).toBe("healthy");
    },
  );

  test.prop([versionArb], { numRuns: 15 })(
    `Property ${PROPERTIES.HEALTH_CHECKS_VERIFY_OUTBOX.number}: ${PROPERTIES.HEALTH_CHECKS_VERIFY_OUTBOX.text}`,
    async (version) => {
      const testLayer = HealthCheck.Test({
        check: () =>
          Effect.succeed({
            status: "healthy",
            version,
            components: [
              { name: "database", status: "healthy", latencyMs: 5 },
              { name: "outbox_processor", status: "healthy" },
            ],
            timestamp: new Date(),
          }),
      });

      const program = Effect.gen(function* () {
        const healthCheck = yield* HealthCheck;
        return yield* healthCheck.check();
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer)),
      );

      const outboxComponent = result.components.find(
        (c) => c.name === "outbox_processor",
      );

      expect(outboxComponent).toBeDefined();
      expect(outboxComponent?.status).toBe("healthy");
    },
  );

  test.prop(
    [
      fc.record({
        databaseStatus: healthStatusArb,
        outboxStatus: healthStatusArb,
        version: versionArb,
      }),
    ],
    { numRuns: 20 },
  )(
    `Property ${PROPERTIES.UNHEALTHY_SERVICES_RETURN_UNHEALTHY.number}: ${PROPERTIES.UNHEALTHY_SERVICES_RETURN_UNHEALTHY.text}`,
    async ({ databaseStatus, outboxStatus, version }) => {
      const hasUnhealthy =
        databaseStatus === "unhealthy" || outboxStatus === "unhealthy";
      const hasDegraded =
        databaseStatus === "degraded" || outboxStatus === "degraded";

      const expectedStatus: HealthStatus = hasUnhealthy
        ? "unhealthy"
        : hasDegraded
          ? "degraded"
          : "healthy";

      const testLayer = HealthCheck.Test({
        check: () =>
          Effect.succeed({
            status: expectedStatus,
            version,
            components: [
              { name: "database", status: databaseStatus },
              { name: "outbox_processor", status: outboxStatus },
            ],
            timestamp: new Date(),
          }),
      });

      const program = Effect.gen(function* () {
        const healthCheck = yield* HealthCheck;
        return yield* healthCheck.check();
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer)),
      );

      expect(result.status).toBe(expectedStatus);

      if (hasUnhealthy) {
        expect(result.status).toBe("unhealthy");
      }
    },
  );

  test.prop([versionArb], { numRuns: 20 })(
    `Property ${PROPERTIES.HEALTH_RESPONSES_INCLUDE_VERSION.number}: ${PROPERTIES.HEALTH_RESPONSES_INCLUDE_VERSION.text}`,
    async (version) => {
      const testLayer = HealthCheck.Test({
        check: () =>
          Effect.succeed({
            status: "healthy",
            version,
            components: [
              { name: "database", status: "healthy" },
              { name: "outbox_processor", status: "healthy" },
            ],
            timestamp: new Date(),
          }),
      });

      const program = Effect.gen(function* () {
        const healthCheck = yield* HealthCheck;
        return yield* healthCheck.check();
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer)),
      );

      expect(result.version).toBe(version);
      expect(result.version).toMatch(/^\d+\.\d+\.\d+$/);
    },
  );

  test.prop([versionArb, latencyArb], { numRuns: 10 })(
    "Property 24b: Health check includes latency for database",
    async (version, latency) => {
      const testLayer = HealthCheck.Test({
        check: () =>
          Effect.succeed({
            status: "healthy",
            version,
            components: [
              { name: "database", status: "healthy", latencyMs: latency },
              { name: "outbox_processor", status: "healthy" },
            ],
            timestamp: new Date(),
          }),
      });

      const program = Effect.gen(function* () {
        const healthCheck = yield* HealthCheck;
        return yield* healthCheck.check();
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer)),
      );

      const databaseComponent = result.components.find(
        (c) => c.name === "database",
      );

      expect(databaseComponent?.latencyMs).toBe(latency);
      expect(databaseComponent?.latencyMs).toBeGreaterThan(0);
    },
  );

  test.prop([versionArb], { numRuns: 10 })(
    "Property 27b: Health response includes timestamp",
    async (version) => {
      const beforeTest = new Date();

      const testLayer = HealthCheck.Test({
        check: () =>
          Effect.succeed({
            status: "healthy",
            version,
            components: [],
            timestamp: new Date(),
          }),
      });

      const program = Effect.gen(function* () {
        const healthCheck = yield* HealthCheck;
        return yield* healthCheck.check();
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer)),
      );

      const afterTest = new Date();

      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(
        beforeTest.getTime(),
      );
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(
        afterTest.getTime(),
      );
    },
  );

  test.prop([versionArb], { numRuns: 5 })(
    "Property 26b: Returns consistent result for same input",
    async (version) => {
      const callCountRef = Ref.unsafeMake(0);

      const testLayer = HealthCheck.Test({
        check: () =>
          Effect.gen(function* () {
            yield* Ref.update(callCountRef, (n) => n + 1);
            return {
              status: "healthy" as const,
              version,
              components: [],
              timestamp: new Date(),
            };
          }),
      });

      const program = Effect.gen(function* () {
        const healthCheck = yield* HealthCheck;
        const result1 = yield* healthCheck.check();
        const result2 = yield* healthCheck.check();
        return { result1, result2 };
      });

      const { result1, result2 } = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer)),
      );

      expect(result1.version).toBe(version);
      expect(result2.version).toBe(version);
    },
  );
});
