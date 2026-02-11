import * as crypto from "node:crypto";
import { HttpApiBuilder, HttpServerRequest } from "@effect/platform";
import { BookingService } from "@workspace/application/booking.service";
import { BookingId } from "@workspace/domain/kernel";
import { Effect, Redacted } from "effect";
import { Api } from "../api.js";
import { ApiConfig } from "../config/api-config.js";
import { TransientError, WebhookAuthenticationError } from "./api.js";

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

const verifySignature = (
  request: HttpServerRequest.HttpServerRequest,
  secret: Redacted.Redacted<string>,
) =>
  Effect.gen(function* () {
    const rawBody = yield* request.text;
    const signature = request.headers["webhook-signature"];

    if (!signature || typeof signature !== "string") {
      yield* Effect.logWarning("Missing webhook-signature header");
      return yield* Effect.fail(new WebhookAuthenticationError());
    }

    if (!signature.startsWith("v1=")) {
      yield* Effect.logWarning("Invalid webhook-signature format");
      return yield* Effect.fail(new WebhookAuthenticationError());
    }

    // Cast secret to string to satisfy type checker if inference fails
    // or assume Redacted.value returns string if secret is Redacted<string>
    const hmac = crypto.createHmac("sha256", Redacted.value(secret));
    const digest = `v1=${hmac.update(rawBody).digest("hex")}`;

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest),
    );

    if (!isValid) {
      yield* Effect.logWarning("Invalid webhook-signature");
      return yield* Effect.fail(new WebhookAuthenticationError());
    }
  });

export const handlePolarWebhook = (payload: {
  readonly type: string;
  readonly data: any;
}): Effect.Effect<
  { readonly received: boolean },
  TransientError | WebhookAuthenticationError,
  BookingService | ApiConfig | HttpServerRequest.HttpServerRequest
> =>
  Effect.gen(function* () {
    const config = yield* ApiConfig;
    const request = yield* HttpServerRequest.HttpServerRequest;

    // Explicitly cast or trust the type from ApiConfig
    yield* verifySignature(
      request,
      config.polarWebhookSecret as Redacted.Redacted<string>,
    );

    const bookingService = yield* BookingService;

    // Process only checkout.updated events
    if (payload.type === "checkout.updated") {
      const { status, metadata } = payload.data;

      if (status === "succeeded") {
        const bookingId = metadata?.bookingId;

        if (bookingId) {
          yield* Effect.logInfo(
            `Polar Webhook: Processing payment success for booking ${bookingId}`,
          );
          yield* bookingService.confirmBooking(BookingId.make(bookingId));
        } else {
          yield* Effect.logError(
            `Polar Webhook: checkout.updated(succeeded) received but missing bookingId in metadata. Payload ID: ${
              payload.data?.id ?? "unknown"
            }`,
          );
        }
      }
    }

    return { received: true };
  }).pipe(
    Effect.catchAll(
      (
        e,
      ): Effect.Effect<
        { readonly received: boolean },
        TransientError | WebhookAuthenticationError,
        never
      > => {
        // If error is authentication error, propagate it
        if (e instanceof WebhookAuthenticationError) {
          return Effect.fail(e);
        }

        // Discriminate between transient/infrastructure errors and business errors
        if (isTransientError(e)) {
          return Effect.logError(
            `Transient error in webhook processing (retrying): ${String(e)}`,
          ).pipe(
            Effect.flatMap(() =>
              Effect.fail(
                new TransientError({
                  message: String(e),
                }),
              ),
            ),
          );
        }

        // We return success to Polar for business errors to avoid unnecessary retries
        return Effect.logError(`Business error in webhook: ${String(e)}`).pipe(
          Effect.as({ received: true }),
        );
      },
    ),
  );

export const WebhookApiLive = HttpApiBuilder.group(
  Api,
  "webhooks",
  (handlers) =>
    handlers.handle("polar", ({ payload }) => handlePolarWebhook(payload)),
);
