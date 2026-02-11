import { HttpApiBuilder } from "@effect/platform";
import { BookingService } from "@workspace/application/booking.service";
import { BookingId } from "@workspace/domain/kernel";
import { Effect } from "effect";
import { Api } from "../api.js";
import { TransientError } from "./api.js";

const isTransientError = (e: unknown): boolean => {
  if (typeof e === "object" && e !== null && "_tag" in e) {
    const tag = (e as { _tag: string })._tag;
    return (
      tag === "SqlError" ||
      tag === "OptimisticLockingError" ||
      tag === "BookingPersistenceError" ||
      tag === "InventoryPersistenceError" ||
      tag === "RequestTimeoutError" ||
      tag === "TimeoutException"
    );
  }
  return false;
};

/**
 * Core handler for Polar webhooks.
 * Exported to allow direct testing without spinning up the full HTTP server.
 */
export const handlePolarWebhook = (payload: {
  readonly type: string;
  readonly data: any;
}) =>
  Effect.gen(function* () {
    const bookingService = yield* BookingService;

    // Process only checkout.succeeded events
    if (payload.type === "checkout.succeeded") {
      const metadata = payload.data.metadata;
      const bookingId = metadata?.bookingId;

      if (bookingId) {
        yield* Effect.logInfo(
          `Polar Webhook: Processing payment success for booking ${bookingId}`,
        );
        yield* bookingService.confirmBooking(BookingId.make(bookingId));
      } else {
        yield* Effect.logError(
          `Polar Webhook: checkout.succeeded received but missing bookingId in metadata. Type: ${
            payload.type
          }, ID: ${payload.data.metadata?.bookingId ?? "unknown"}`,
        );
      }
    }

    return { received: true };
  }).pipe(
    Effect.catchAll((e) => {
      // Discriminate between transient/infrastructure errors and business errors
      if (isTransientError(e)) {
        return Effect.logError(
          `Transient error in webhook processing (retrying): ${String(e)}`,
        ).pipe(
          Effect.flatMap(() =>
            Effect.fail(new TransientError({ message: String(e) })),
          ),
        );
      }

      // We return success to Polar for business errors to avoid unnecessary retries
      return Effect.logError(`Business error in webhook: ${String(e)}`).pipe(
        Effect.as({ received: true }),
      );
    }),
  );

export const WebhookApiLive = HttpApiBuilder.group(
  Api,
  "webhooks",
  (handlers) =>
    handlers.handle("polar", ({ payload }) => handlePolarWebhook(payload)),
);
