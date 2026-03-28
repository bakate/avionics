import { type CurrencyCode, type Money } from "@workspace/domain/kernel";
import { DateTime, Duration, Option } from "effect";

// ---------------------------------------------------------------------------
// Date / Time formatting
// ---------------------------------------------------------------------------

/** Format a Date to "HH:mm" (e.g. "14:35") */
export const formatTime = (date: Date, locale: string = "fr"): string =>
  Option.match(DateTime.makeZoned(date), {
    onNone: () =>
      date.toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    onSome: (dt) =>
      DateTime.format(dt, {
        locale: locale,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
  });

/** Format a Date to "dd MMM yyyy" (e.g. "15 juin 2026") */
export const formatDate = (date: Date): string =>
  Option.match(DateTime.makeZoned(date), {
    onNone: () =>
      date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    onSome: (dt) =>
      DateTime.format(dt, {
        locale: "fr-FR",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
  });

/** Format a Date to "HH:mm · dd MMM yyyy" */
export const formatDateTime = (date: Date, locale: string = "fr"): string =>
  `${formatDate(date)} ${locale === "fr" ? "à" : "at"} ${formatTime(date)}`;

/** Format a Date to "yyyy-MM-dd" using local time to avoid UTC shift */
export const toISODate = (date: Date): string =>
  Option.match(DateTime.makeZoned(date), {
    onNone: () => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    },
    onSome: (dt) => DateTime.formatIsoDate(dt),
  });

// ---------------------------------------------------------------------------
// Duration
// ---------------------------------------------------------------------------

/** Compute duration between two Dates as an Effect Duration */
export const scheduleDuration = (
  departure: Date,
  arrival: Date,
): Duration.Duration => {
  const depDt = DateTime.make(departure);
  const arrDt = DateTime.make(arrival);

  if (Option.isSome(depDt) && Option.isSome(arrDt)) {
    return DateTime.distanceDuration(depDt.value, arrDt.value);
  }

  return Duration.millis(arrival.getTime() - departure.getTime());
};

/** Compute duration in minutes between two Dates */
export const durationMinutes = (departure: Date, arrival: Date): number =>
  Math.max(
    0,
    Math.round(
      Duration.toMillis(scheduleDuration(departure, arrival)) / 60_000,
    ),
  );

/** Format a duration in minutes to "Xh YYmin" (e.g. "2h 30min") */
export const formatDuration = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}min`;
};

/** Compute and format duration from a schedule (departure + arrival Dates) */
export const formatScheduleDuration = (
  departure: Date,
  arrival: Date,
): string => formatDuration(durationMinutes(departure, arrival));

// ---------------------------------------------------------------------------
// Price / Money formatting
// ---------------------------------------------------------------------------

const currencyLocaleMap: Record<CurrencyCode, string> = {
  EUR: "fr-FR",
  USD: "en-US",
  GBP: "en-GB",
  CHF: "de-CH",
};

/** Format a Money value to a localized currency string (e.g. "150,00 €") */
export const formatMoney = (money: Money): string =>
  new Intl.NumberFormat(currencyLocaleMap[money.currency], {
    style: "currency",
    currency: money.currency,
  }).format(money.amount);

// ---------------------------------------------------------------------------
// Total price calculation
// ---------------------------------------------------------------------------

type PriceInput = { readonly amount: number; readonly currency: string };

/**
 * Calculate total booking price.
 * Formula: (outbound price + return price) × total passenger count
 *
 */
export const calculateTotalPrice = (params: {
  outboundPrice: PriceInput;
  returnPrice: PriceInput | null;
  passengerCount: number;
}): PriceInput => {
  const returnAmount = params.returnPrice?.amount ?? 0;
  const perPassenger = params.outboundPrice.amount + returnAmount;
  return {
    amount: perPassenger * params.passengerCount,
    currency: params.outboundPrice.currency,
  };
};
