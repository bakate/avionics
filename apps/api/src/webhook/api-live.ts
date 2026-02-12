import * as crypto from "node:crypto";
import { HttpApiBuilder, HttpServerRequest } from "@effect/platform";
import { BookingService } from "@workspace/application/booking.service";
import { ApiConfig } from "@workspace/config";
import { BookingId } from "@workspace/domain/kernel";
import { Effect, Redacted, Schema } from "effect";
import { Api } from "../api.js";
import {
  MalformedPayloadError,
  TransientError,
  WebhookAuthenticationError,
} from "./api.js";

// Payload validation schema
const PolarCheckoutPayload = Schema.Struct({
  type: Schema.Literal("checkout.updated"),
  data: Schema.Struct({
    id: Schema.String,
    status: Schema.String,
    metadata: Schema.optional(
      Schema.Struct({
        bookingId: Schema.optional(Schema.String),
      }),
    ),
  }),
});

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

const parseSignature = (signatureHeader: string): string | null => {
  // Split on whitespace to handle multiple signatures (rotation)
  const tokens = signatureHeader.split(/\s+/).filter(Boolean);

  // Look for v1 signature format first
  const v1Token = tokens.find((t) => /^v1[=,]/.test(t));
  if (v1Token) {
    const match = v1Token.match(/^v1[=,](.+)$/);
    return match?.[1] ?? null;
  }

  // Fallback: try to extract signature from first token
  const firstToken = tokens[0];
  if (!firstToken) {
    return null;
  }

  const match = firstToken.match(/[=,](.+)$/);
  if (match) {
    return match[1] ?? null;
  }
  // If no delimiter found, assume entire token is signature
  return firstToken;
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

    const signature = parseSignature(signatureHeader);

    if (!signature) {
      yield* Effect.logWarning("Invalid webhook-signature format", {
        signatureHeader,
      });
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
        difference: Math.abs(now - timestampMs),
      });
      return yield* Effect.fail(new WebhookAuthenticationError());
    }

    const signedContent = `${msgId}.${msgTimestamp}.${rawBody}`;

    const hmac = crypto.createHmac("sha256", Redacted.value(secret));
    const digest = hmac.update(signedContent).digest();

    // Auto-detect signature format (hex or base64)
    const signatureBuffer = Buffer.from(
      signature,
      signature.length === 64 ? "hex" : "base64",
    );

    if (signatureBuffer.length !== digest.length) {
      yield* Effect.logWarning("Webhook signature length mismatch", {
        expected: digest.length,
        received: signatureBuffer.length,
      });
      return yield* Effect.fail(new WebhookAuthenticationError());
    }

    const isValid = crypto.timingSafeEqual(signatureBuffer, digest);

    if (!isValid) {
      yield* Effect.logWarning("Invalid webhook-signature");
      return yield* Effect.fail(new WebhookAuthenticationError());
    }

    return rawBody;
  });

export const processWebhookPayload = (payload: unknown) =>
  Effect.gen(function* () {
    const bookingService = yield* BookingService;

    // Validate payload structure
    const decoded = yield* Schema.decodeUnknown(PolarCheckoutPayload)(
      payload,
    ).pipe(
      Effect.catchAll(() => {
        // Not a checkout.updated event or invalid structure - ignore silently
        return Effect.succeed(null);
      }),
    );

    if (!decoded) {
      // Unknown event type or invalid structure - return success to avoid retries
      return { received: true };
    }

    // Process only checkout.updated events with succeeded status
    if (decoded.data.status === "succeeded") {
      const bookingId = decoded.data.metadata?.bookingId;

      if (bookingId) {
        yield* Effect.logInfo(
          `Polar Webhook: Processing payment success for booking ${bookingId}`,
        );

        // Note: confirmBooking should be idempotent to handle duplicate webhooks
        yield* bookingService.confirmBooking(BookingId.make(bookingId));
      } else {
        yield* Effect.logError(
          `Polar Webhook: checkout.updated(succeeded) received but missing bookingId in metadata. Payload ID: ${decoded.data.id}`,
        );
      }
    }

    return { received: true };
  });

export const handlePolarWebhook = (payload?: unknown) =>
  Effect.gen(function* () {
    if (payload) {
      return yield* processWebhookPayload(payload);
    }

    const config = yield* ApiConfig;
    const request = yield* HttpServerRequest.HttpServerRequest;

    const rawBody = yield* verifySignature(
      request,
      config.polarWebhookSecret as Redacted.Redacted<string>,
    );

    // Safe JSON parsing
    const parsedPayload = yield* Effect.try({
      try: () => JSON.parse(rawBody),
      catch: (e) =>
        new MalformedPayloadError({
          message: `Malformed JSON in webhook body: ${String(e)}`,
        }),
    });

    return yield* processWebhookPayload(parsedPayload);
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
