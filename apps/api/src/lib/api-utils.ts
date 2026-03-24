import { HttpMiddleware, HttpServerRequest } from "@effect/platform";
import { Effect } from "effect";

/**
 * Middleware: Request Logging
 * Logs incoming request details and duration.
 */
export const logger = HttpMiddleware.logger;

/**
 * Middleware: Request Tracking (X-Request-ID)
 * Ensures every request has a unique identifier for tracing.
 */
export const requestTracking = HttpMiddleware.make((httpApp) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const headerId = request.headers["x-request-id"];
    const requestId =
      headerId ?? (yield* Effect.sync(() => crypto.randomUUID()));

    return yield* httpApp.pipe(
      Effect.annotateLogs("requestId", requestId),
      Effect.map((response) => ({
        ...response,
        headers: {
          ...response.headers,
          "x-request-id": requestId,
        },
      })),
    );
  }),
);

/**
 * Helper: Map domain/internal errors to the API contract.
 * Reduces boilerplate in handlers while ensuring defects are logged.
 */
export const mapToContract = <E_Contract extends { readonly _tag: string }>(
  allowedTags: ReadonlyArray<string>,
  onUnexpected: (error: unknown) => E_Contract,
) => {
  return <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.catchAll(
      effect,
      (error: unknown): Effect.Effect<A, E_Contract, R> => {
        // 1. Check if it's already an allowed contract error
        if (
          error != null &&
          typeof error === "object" &&
          "_tag" in error &&
          typeof (error as { readonly _tag: unknown })._tag === "string"
        ) {
          const tag = (error as { readonly _tag: string })._tag;
          if (allowedTags.includes(tag)) {
            return Effect.fail(error as E_Contract);
          }
        }

        // 2. Log defect for observability
        return Effect.logError("Unexpected Error in API Handler", {
          error,
        }).pipe(Effect.flatMap(() => Effect.fail(onUnexpected(error))));
      },
    );
};
