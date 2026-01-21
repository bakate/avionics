import type { Money } from "@workspace/domain/kernel";
import { Context, type Effect } from "effect";

export class PaymentGateway extends Context.Tag("PaymentGateway")<
	PaymentGateway,
	{
		readonly charge: (amount: Money, token: string) => Effect.Effect<void>;
	}
>() {}
