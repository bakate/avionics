import { SqlClient } from "@effect/sql";
import { Context, Effect, Layer, Option } from "effect";

type AggregateType = "Booking" | "FlightInventory" | "Ticket";
type OperationType = "CREATE" | "UPDATE" | "DELETE";

export interface AuditLogParams {
  readonly aggregateType: AggregateType;
  readonly aggregateId: string;
  readonly operation: OperationType;
  readonly changes: unknown;
}

export interface AuditLoggerSignature {
  /**
   * Fire-and-forget audit log.
   * Uses forkDaemon to not block the caller.
   * Failures are logged but not propagated.
   */
  readonly log: (params: AuditLogParams) => Effect.Effect<void>;

  /**
   * Synchronous audit log.
   * Waits for the insert to complete.
   * Useful for tests or critical audit scenarios.
   */
  readonly logSync: (params: AuditLogParams) => Effect.Effect<void>;
}

export class UserContext extends Context.Tag("UserContext")<
  UserContext,
  { readonly userId: string }
>() {}

export class AuditLogger extends Context.Tag("AuditLogger")<
  AuditLogger,
  AuditLoggerSignature
>() {
  /**
   * Live Layer — Production implementation.
   * Requires SqlClient in context.
   */
  static readonly Live = Layer.effect(
    AuditLogger,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const insertAuditRecord = (
        params: AuditLogParams,
        userId: string | null,
      ) =>
        Effect.gen(function* () {
          const timestamp = new Date();

          yield* sql`
            INSERT INTO audit_log (aggregate_type, aggregate_id, operation, changes, user_id, timestamp)
            VALUES (
              ${params.aggregateType},
              ${params.aggregateId},
              ${params.operation},
              ${JSON.stringify(params.changes)},
              ${userId},
              ${timestamp}
            )
          `;

          yield* Effect.logDebug("Audit record created", {
            aggregateType: params.aggregateType,
            aggregateId: params.aggregateId,
            operation: params.operation,
          });
        });

      return {
        log: (params) =>
          Effect.gen(function* () {
            const userContext = yield* Effect.serviceOption(UserContext);
            const userId = Option.getOrNull(
              Option.map(userContext, (ctx) => ctx.userId),
            );

            yield* insertAuditRecord(params, userId).pipe(
              Effect.catchAll((error) =>
                Effect.logWarning("Failed to create audit record", {
                  error: String(error),
                  aggregateType: params.aggregateType,
                  aggregateId: params.aggregateId,
                }),
              ),
              Effect.forkDaemon,
            );
          }),

        logSync: (params) =>
          Effect.gen(function* () {
            const userContext = yield* Effect.serviceOption(UserContext);
            const userId = Option.getOrNull(
              Option.map(userContext, (ctx) => ctx.userId),
            );

            yield* insertAuditRecord(params, userId).pipe(
              Effect.catchAll((error) =>
                Effect.logWarning("Failed to create audit record (sync)", {
                  error: String(error),
                  aggregateType: params.aggregateType,
                  aggregateId: params.aggregateId,
                }),
              ),
            );
          }),
      };
    }),
  );

  /**
   * Test Layer — Factory that returns a complete Layer for tests.
   *
   * Default behaviors (without override):
   *   - log: Logs debug message without side effects
   *   - logSync: Same as log
   *
   * Usage in a test:
   *   const layer = AuditLogger.Test({ log: ... });
   *   program.pipe(Effect.provide(layer))
   */
  static readonly Test = (overrides: Partial<AuditLoggerSignature> = {}) =>
    Layer.succeed(
      AuditLogger,
      AuditLogger.of({
        log: (params) =>
          Effect.logDebug("[TEST] Audit log (fire-and-forget)", {
            aggregateType: params.aggregateType,
            aggregateId: params.aggregateId,
            operation: params.operation,
          }),

        logSync: (params) =>
          Effect.logDebug("[TEST] Audit log (sync)", {
            aggregateType: params.aggregateType,
            aggregateId: params.aggregateId,
            operation: params.operation,
          }),

        ...overrides,
      }),
    );
}
