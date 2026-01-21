import type { CurrencyMismatchError } from "@workspace/domain/errors";
import type { CurrencyCode, Money } from "@workspace/domain/kernel";
import { Context, type Effect } from "effect";

export interface CurrencyConverter {
	convert: (
		money: Money,
		toCurrency: CurrencyCode,
	) => Effect.Effect<Money, CurrencyMismatchError>;
}

export class CurrencyConverterGateway extends Context.Tag(
	"CurrencyConverterGateway",
)<CurrencyConverterGateway, CurrencyConverter>() {}
