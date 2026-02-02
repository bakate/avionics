// Basic Mock Gateway for Payment
// Real implementation would use Polar API
import { PaymentGateway } from "@workspace/application/payment.gateway";
import { Effect, Layer } from "effect";

export const PaymentGatewayLive = Layer.succeed(
  PaymentGateway,
  PaymentGateway.of({
    charge: (amount, token) =>
      Effect.logInfo(
        `[Payment] Charging ${amount.amount} ${amount.currency} with token ${token}`,
      ),
  }),
);
