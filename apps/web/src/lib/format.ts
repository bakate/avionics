import { type CurrencyCode, type Money } from "@workspace/domain/kernel";
import { DateTime, Duration } from "effect";

// ---------------------------------------------------------------------------
// Date / Time formatting
// ---------------------------------------------------------------------------

/** Format a Date to "HH:mm" (e.g. "14:35") */
export const formatTime = (date: Date): string =>
  DateTime.format(DateTime.unsafeMake(date), {
    locale: "fr-FR",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

/** Format a Date to "dd MMM yyyy" (e.g. "15 juin 2026") */
export const formatDate = (date: Date): string =>
  DateTime.format(DateTime.unsafeMake(date), {
    locale: "fr-FR",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/** Format a Date to "HH:mm · dd MMM yyyy" */
export const formatDateTime = (date: Date): string =>
  `${formatTime(date)} · ${formatDate(date)}`;

// ---------------------------------------------------------------------------
// Duration
// ---------------------------------------------------------------------------

/** Compute duration between two Dates as an Effect Duration */
export const scheduleDuration = (
  departure: Date,
  arrival: Date,
): Duration.Duration =>
  DateTime.distanceDuration(
    DateTime.unsafeMake(departure),
    DateTime.unsafeMake(arrival),
  );

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
