import {
  NotificationGateway,
  NotificationRateLimitError,
} from "@workspace/application/notification.gateway";
import { type Ticket } from "@workspace/domain/ticket";
import { Effect, Layer, Redacted } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResendNotificationGatewayCreateLive } from "../../../gateways/notification-gateway.js";
import { AuditLoggerTest } from "../../../services/audit-logger.js";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("resend", () => {
  return {
    Resend: class {
      emails = {
        send: mocks.send,
      };
    },
  };
});

describe("NotificationGateway Rate Limit Handling", () => {
  const config = {
    apiKey: Redacted.make("re_123"),
    fromEmail: "test@example.com",
    maxRetries: 0,
    baseUrl: "https://api.resend.com",
    timeout: 1000,
  };

  const ticket = {
    ticketNumber: "1234567890123",
    pnrCode: "ABCDEF",
    passengerName: "John Doe",
    coupons: [],
    issuedAt: new Date(),
    status: "ISSUED",
  } as unknown as Ticket;

  const recipient = {
    email: "john@example.com",
    name: "John Doe",
  };

  const createGatewayLayer = () =>
    ResendNotificationGatewayCreateLive(config).pipe(
      Layer.provide(AuditLoggerTest()),
    );

  const sendTicketProgram = Effect.gen(function* () {
    const gateway = yield* NotificationGateway;
    return yield* gateway.sendTicket(ticket, recipient);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse integer Retry-After header", async () => {
    const error = Object.assign(new Error("Rate limit exceeded"), {
      statusCode: 429,
      headers: { "retry-after": "120" },
    });

    mocks.send.mockRejectedValue(error);

    const errorResult = await Effect.runPromise(
      sendTicketProgram.pipe(Effect.provide(createGatewayLayer()), Effect.flip),
    );

    expect(errorResult).toBeInstanceOf(NotificationRateLimitError);
    expect((errorResult as NotificationRateLimitError).retryAfterSeconds).toBe(
      120,
    );
  });

  it("should parse HTTP-date Retry-After header", async () => {
    const futureDate = new Date(Date.now() + 90000).toUTCString(); // 90 seconds from now
    const error = Object.assign(new Error("Rate limit exceeded"), {
      statusCode: 429,
      headers: { "retry-after": futureDate },
    });

    mocks.send.mockRejectedValue(error);

    const errorResult = await Effect.runPromise(
      sendTicketProgram.pipe(Effect.provide(createGatewayLayer()), Effect.flip),
    );

    expect(errorResult).toBeInstanceOf(NotificationRateLimitError);
    // Allow small delta for execution time
    const retryAfter = (errorResult as NotificationRateLimitError)
      .retryAfterSeconds;
    expect(retryAfter).toBeGreaterThanOrEqual(89);
    expect(retryAfter).toBeLessThanOrEqual(91);
  });

  it("should handle case-insensitive Retry-After header", async () => {
    const error = Object.assign(new Error("Rate limit exceeded"), {
      statusCode: 429,
      headers: { "Retry-After": "45" },
    });

    mocks.send.mockRejectedValue(error);

    const errorResult = await Effect.runPromise(
      sendTicketProgram.pipe(Effect.provide(createGatewayLayer()), Effect.flip),
    );

    expect(errorResult).toBeInstanceOf(NotificationRateLimitError);
    expect((errorResult as NotificationRateLimitError).retryAfterSeconds).toBe(
      45,
    );
  });

  it("should default to 60 seconds if header is missing", async () => {
    const error = Object.assign(new Error("Rate limit exceeded"), {
      statusCode: 429,
      headers: {},
    });

    mocks.send.mockRejectedValue(error);

    const errorResult = await Effect.runPromise(
      sendTicketProgram.pipe(Effect.provide(createGatewayLayer()), Effect.flip),
    );

    expect(errorResult).toBeInstanceOf(NotificationRateLimitError);
    expect((errorResult as NotificationRateLimitError).retryAfterSeconds).toBe(
      60,
    );
  });

  it("should handle API-returned error (non-throwing) for rate limit", async () => {
    // Simulate Resend returning { error: ... } instead of throwing
    const apiError = Object.assign(new Error("Rate limit exceeded"), {
      statusCode: 429,
      name: "validation_error",
    });

    // We need to mock the response structure { data: null, error: apiError }
    mocks.send.mockResolvedValue({
      data: null,
      error: apiError,
    });

    const errorResult = await Effect.runPromise(
      sendTicketProgram.pipe(Effect.provide(createGatewayLayer()), Effect.flip),
    );

    // It should be mapped to NotificationRateLimitError
    expect(errorResult).toBeInstanceOf(NotificationRateLimitError);
    // Since we didn't provide headers in the error object (mocked as simple object),
    // it should default to 60s
    expect((errorResult as NotificationRateLimitError).retryAfterSeconds).toBe(
      60,
    );
  });
});
