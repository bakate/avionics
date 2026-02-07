import { type CurrencyMismatchError } from "@workspace/domain/errors";
import { type CurrencyCode, type Money } from "@workspace/domain/kernel";
import { Context, Data, type Effect } from "effect";

/**
 * Error when currency API is unavailable
 */
export class CurrencyApiUnavailableError extends Data.TaggedError(
  "CurrencyApiUnavailableError",
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Union of all currency conversion errors
 */
export type CurrencyConversionError =
  | CurrencyMismatchError
  | CurrencyApiUnavailableError;

/**
 * Port for currency conversion operations
 */
export interface CurrencyConverter {
  readonly convert: (
    money: Money,
    toCurrency: CurrencyCode,
  ) => Effect.Effect<Money, CurrencyConversionError>;
}

export class CurrencyConverterGateway extends Context.Tag(
  "CurrencyConverterGateway",
)<CurrencyConverterGateway, CurrencyConverter>() {}
