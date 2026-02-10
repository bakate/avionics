import { RequestTimeoutError } from "@polar-sh/sdk/models/errors/httpclienterrors.js";
import { PaymentError as PolarPaymentError } from "@polar-sh/sdk/models/errors/paymenterror.js";
import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound.js";
import { PaymentGateway } from "@workspace/application/payment.gateway";
import { Money } from "@workspace/domain/kernel";
import { Cause, ConfigProvider, Effect, Option as EOption, Exit } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PolarPaymentGatewayLive } from "../../../gateways/payment-gateway";
import { AuditLoggerTest } from "../../../services/audit-logger.js";

// Hoisted mocks to be accessible inside vi.mock factory
const mocks = vi.hoisted(() => {
  return {
    checkoutsCreate: vi.fn(),
    checkoutsGet: vi.fn(),
  };
});

// Mock the Polar SDK
vi.mock("@polar-sh/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@polar-sh/sdk")>();
  return {
    ...actual,
    Polar: class {
      checkouts = {
        create: mocks.checkoutsCreate,
        get: mocks.checkoutsGet,
      };
    },
  };
});

describe("PolarPaymentGateway.Live", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to run effects with the Live layer
  const runTest = async <A, E>(effect: Effect.Effect<A, E, PaymentGateway>) => {
    return await Effect.runPromise(
      effect.pipe(
        Effect.provide(PolarPaymentGatewayLive),
        Effect.provide(AuditLoggerTest()),
      ),
    );
  };

  const runTestExit = async <A, E>(
    effect: Effect.Effect<A, E, PaymentGateway>,
  ) => {
    return await Effect.runPromiseExit(
      effect.pipe(
        Effect.provide(PolarPaymentGatewayLive),
        Effect.provide(AuditLoggerTest()),
      ),
    );
  };

  it("should allow CHF currency", async () => {
    mocks.checkoutsCreate.mockResolvedValue({
      id: "chk_123",
      url: "https://polar.sh/checkout/chk_123",
      expiresAt: new Date(),
    });

    const program = Effect.gen(function* () {
      const gateway = yield* PaymentGateway;
      return yield* gateway.createCheckout({
        amount: Money.of(100, "CHF"),
        customer: { email: "test@example.com" },
        bookingReference: "REF123",
        bookingId: "BOOKING123",
        successUrl: "https://example.com",
      });
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(PolarPaymentGatewayLive),
        Effect.provide(AuditLoggerTest()),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(
            new Map([
              ["POLAR_BASE_URL", "https://api.polar.sh"],
              ["POLAR_API_KEY", "test_key"],
              ["POLAR_PRODUCT_ID", "polar_product_test"],
            ]),
          ),
        ),
      ),
    );
    expect(result.id).toBe("chk_123");
    // Currency is stored in metadata since Polar SDK configures currency at product level
    expect(mocks.checkoutsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 10000,
        currency: "chf",
        metadata: expect.objectContaining({
          bookingId: "BOOKING123",
          bookingReference: "REF123",
          requestedCurrency: "CHF",
          actualCurrency: "CHF",
        }),
      }),
      expect.objectContaining({
        fetchOptions: {
          headers: {
            "Idempotency-Key": "checkout-REF123",
          },
        },
      }),
    );
  });

  it("should reject invalid currency with UnsupportedCurrencyError", async () => {
    const program = Effect.gen(function* () {
      const gateway = yield* PaymentGateway;
      return yield* gateway.createCheckout({
        // Bypass Money schema validation by passing a plain object that mimics Money
        // This avoids ParseError from Money constructor/schema validation
        // @ts-expect-error
        amount: { amount: 100, currency: "INVALID" },
        customer: { email: "test@example.com" },
        bookingReference: "REF123",
        bookingId: "BOOKING123",
        successUrl: "https://example.com",
      });
    });

    const exit = await runTestExit(program);
    if (Exit.isSuccess(exit)) {
      throw new Error("Expected failure");
    }
    const failure = Cause.failureOption(exit.cause).pipe(EOption.getOrNull);

    expect(failure).toMatchObject({
      _tag: "UnsupportedCurrencyError",
      currency: "INVALID",
    });
  });

  it("should retry on transient errors (RequestTimeoutError)", async () => {
    // Fail once, then succeed
    mocks.checkoutsCreate
      .mockRejectedValueOnce(new RequestTimeoutError("Timeout"))
      .mockResolvedValue({
        id: "chk_retry",
        url: "https://polar.sh/checkout/chk_retry",
        expiresAt: new Date(),
      });

    const program = Effect.gen(function* () {
      const gateway = yield* PaymentGateway;
      return yield* gateway.createCheckout({
        amount: Money.of(100, "USD"),
        customer: { email: "test@example.com" },
        bookingReference: "REF123",
        bookingId: "BOOKING123",
        successUrl: "https://example.com",
      });
    });

    const result = await runTest(program);
    expect(result.id).toBe("chk_retry");
    expect(mocks.checkoutsCreate).toHaveBeenCalledTimes(2);
  });

  it("should NOT retry on non-transient errors (PolarPaymentError)", async () => {
    // Fail with payment error
    // Helper to create error metadata
    const httpMeta = {
      request: new Request("http://test"),
      response: new Response(),
      body: "",
    };

    mocks.checkoutsCreate.mockRejectedValue(
      new PolarPaymentError(
        { error: "PaymentError", detail: "Declined" },
        httpMeta,
      ),
    );

    const program = Effect.gen(function* () {
      const gateway = yield* PaymentGateway;
      return yield* gateway.createCheckout({
        amount: Money.of(100, "USD"),
        customer: { email: "test@example.com" },
        bookingReference: "REF123",
        bookingId: "BOOKING123",
        successUrl: "https://example.com",
      });
    });

    const exit = await runTestExit(program);
    if (Exit.isSuccess(exit)) {
      throw new Error("Expected failure");
    }
    const failure = Cause.failureOption(exit.cause).pipe(EOption.getOrNull);
    expect(failure).toMatchObject({
      _tag: "PaymentDeclinedError",
    });
    expect(mocks.checkoutsCreate).toHaveBeenCalledTimes(1);
  });

  it("should map failed status correctly", async () => {
    mocks.checkoutsGet.mockResolvedValue({
      status: "failed",
      failureReason: "Insufficient funds",
    });

    const program = Effect.gen(function* () {
      const gateway = yield* PaymentGateway;
      return yield* gateway.getCheckoutStatus("chk_failed");
    });

    const result = await runTest(program);
    expect(result).toEqual({
      status: "failed",
      reason: "Insufficient funds",
    });
  });

  it("should map expired status correctly", async () => {
    mocks.checkoutsGet.mockResolvedValue({
      status: "expired",
    });

    const program = Effect.gen(function* () {
      const gateway = yield* PaymentGateway;
      return yield* gateway.getCheckoutStatus("chk_expired");
    });

    const result = await runTest(program);
    expect(result).toEqual({
      status: "expired",
    });
  });

  it("should map succeeded status correctly using timestamp fields", async () => {
    const now = new Date();
    mocks.checkoutsGet.mockResolvedValue({
      id: "chk_success",
      status: "succeeded",
      totalAmount: 10000,
      currency: "usd",
      succeededAt: now.toISOString(),
    });

    const program = Effect.gen(function* () {
      const gateway = yield* PaymentGateway;
      return yield* gateway.getCheckoutStatus("chk_success");
    });

    const result = await runTest(program);
    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.confirmation.paidAt).toEqual(now);
    }
  });

  it("should map ResourceNotFound to CheckoutNotFoundError", async () => {
    // Helper to create error metadata
    const httpMeta = {
      request: new Request("http://test"),
      response: new Response(),
      body: "",
    };

    mocks.checkoutsGet.mockRejectedValue(
      new ResourceNotFound(
        { error: "ResourceNotFound", detail: "Not found" },
        httpMeta,
      ),
    );

    const program = Effect.gen(function* () {
      const gateway = yield* PaymentGateway;
      return yield* gateway.getCheckoutStatus("chk_missing");
    });

    const exit = await runTestExit(program);
    if (Exit.isSuccess(exit)) {
      throw new Error("Expected failure");
    }
    const failure = Cause.failureOption(exit.cause).pipe(EOption.getOrNull);
    expect(failure).toMatchObject({
      _tag: "CheckoutNotFoundError",
    });
  });
});
