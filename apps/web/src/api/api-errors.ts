import { type HttpClientError } from "@effect/platform/HttpClientError";
import type * as PaymentErrors from "@workspace/application/payment.gateway";
import type * as BookingErrors from "@workspace/domain/errors";
import { type ParseResult } from "effect";
import i18next from "@/i18n/config";

export type ApiError =
  | BookingErrors.FlightFullError
  | BookingErrors.FlightNotFoundError
  | BookingErrors.BookingNotFoundError
  | BookingErrors.BookingExpiredError
  | BookingErrors.BookingStatusError
  | BookingErrors.OptimisticLockingError
  | BookingErrors.ValidationError
  | BookingErrors.InvalidAmountError
  | BookingErrors.InventoryOvercapacityError
  | BookingErrors.BookingPersistenceError
  | BookingErrors.InventoryPersistenceError
  | BookingErrors.RequestTimeoutError
  | PaymentErrors.PaymentDeclinedError
  | PaymentErrors.PaymentApiUnavailableError
  | PaymentErrors.CheckoutNotFoundError
  | PaymentErrors.UnsupportedCurrencyError
  | HttpClientError
  | ParseResult.ParseError;

/**
 * Maps a tagged Error (from Effect) to a user-friendly localized message.
 * This is "tRPC-like" as it leverages the data structure of the error
 * to drive the UI representation without manual glue code.
 */
export const mapApiError = (error: unknown): string => {
  if (typeof error !== "object" || error === null) {
    return i18next.t("errors.unexpected");
  }

  if ("_tag" in error) {
    const errorWithTag = error as { _tag: string };
    const tag = errorWithTag._tag;
    const key = `errors.${tag}`;

    // Use i18next to translate with the error object as interpolation context.
    // This allows messages like "Flight {{flightId}} is full" to work automatically.
    const translated = i18next.t(key, { ...errorWithTag, defaultValue: "" });

    if (translated) {
      return translated;
    }
  }

  if (error instanceof Error) {
    // Log for developers but hide from users
    console.error("[ApiError]", error);
    return i18next.t("errors.unexpected");
  }

  return i18next.t("errors.unexpected");
};
