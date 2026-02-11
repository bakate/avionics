import * as crypto from "node:crypto";
import { HttpApiBuilder, HttpServerRequest } from "@effect/platform";
import { BookingService } from "@workspace/application/booking.service";
import { BookingId } from "@workspace/domain/kernel";
import { Effect, Redacted } from "effect";
import { Api } from "../api.js";
import { ApiConfig } from "../config/api-config.js";
import {
  MalformedPayloadError,
  TransientError,
  WebhookAuthenticationError,
} from "./api.js";

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
    const signatureHeader = request.headers["webhook-signature"];

    if (!signatureHeader || typeof signatureHeader !== "string") {
      yield* Effect.logWarning("Missing webhook-signature header");
      return yield* Effect.fail(new WebhookAuthenticationError());
    }

    // Split on whitespace to handle multiple signatures (rotation)
    const tokens = signatureHeader.split(/\s+/);
    const v1Token = tokens.find((t) => /^v1[=,]/.test(t));

    let signature = "";
    if (v1Token) {
      signature = v1Token.slice(3);
    } else {
      // Fallback to first token value if no v1 found
      const firstToken = tokens[0] ?? "";
      const parts = firstToken.split(/[,=]/);
      signature = parts[1] ?? parts[0] ?? "";
    }

    if (!signature) {
      yield* Effect.logWarning("Invalid webhook-signature format");
      return yield* Effect.fail(new WebhookAuthenticationError());
    }

    // Verify timestamp for replay protection (Svix/Standard Webhooks format)
    const msgId = request.headers["webhook-id"] ?? "unknown";
    const msgTimestamp = request.headers["webhook-timestamp"];

    if (!msgTimestamp || typeof msgTimestamp !== "string") {
      yield* Effect.logWarning("Missing webhook-timestamp header");
      return yield* Effect.fail(new WebhookAuthenticationError());
    }

    const timestampInSeconds = parseInt(msgTimestamp, 10);
    if (Number.isNaN(timestampInSeconds)) {
      yield* Effect.logWarning("Invalid webhook-timestamp header");
      return yield* Effect.fail(new WebhookAuthenticationError());
    }

    const now = Date.now();
    const timestampMs = timestampInSeconds * 1000;
    const tolerance = 5 * 60 * 1000; // 5 minutes

    if (Math.abs(now - timestampMs) > tolerance) {
      yield* Effect.logWarning("Webhook timestamp outside tolerance window", {
        now,
        timestampMs,
      });
      return yield* Effect.fail(new WebhookAuthenticationError());
    }

    const signedContent = `${msgId}.${msgTimestamp}.${rawBody}`;

    const hmac = crypto.createHmac("sha256", Redacted.value(secret));
    const digest = hmac.update(signedContent).digest();

    const signatureBuffer = Buffer.from(
      signature,
      signature.length === 64 ? "hex" : "base64",
    );

    if (signatureBuffer.length !== digest.length) {
      yield* Effect.logWarning("Webhook signature length mismatch");
      return yield* Effect.fail(new WebhookAuthenticationError());
    }

    const isValid = crypto.timingSafeEqual(signatureBuffer, digest);

    if (!isValid) {
      yield* Effect.logWarning("Invalid webhook-signature");
      return yield* Effect.fail(new WebhookAuthenticationError());
    }

    return rawBody;
  });

export const handlePolarWebhook = () =>
  Effect.gen(function* () {
    const config = yield* ApiConfig;
    const request = yield* HttpServerRequest.HttpServerRequest;

    const rawBody = yield* verifySignature(
      request,
      config.polarWebhookSecret as Redacted.Redacted<string>,
    );

    // Safe JSON parsing
    const payload = yield* Effect.try({
      try: () => JSON.parse(rawBody),
      catch: (e) =>
        new MalformedPayloadError({
          message: `Malformed JSON in webhook body: ${String(e)}`,
        }),
    });

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
        TransientError | WebhookAuthenticationError | MalformedPayloadError,
        never
      > => {
        if (e instanceof WebhookAuthenticationError) {
          return Effect.fail(e);
        }

        if (e instanceof MalformedPayloadError) {
          return Effect.fail(e);
        }

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

        // Return success for business errors to avoid retries
        return Effect.logError(
          `Business logic error in webhook: ${String(e)}`,
        ).pipe(Effect.as({ received: true }));
      },
    ),
  );

export const WebhookApiLive = HttpApiBuilder.group(
  Api,
  "webhooks",
  (handlers) => handlers.handle("polar", () => handlePolarWebhook()),
);
