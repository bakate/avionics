import {
  Airplane01Icon,
  Alert01Icon,
  ArrowLeft01Icon,
  Calendar03Icon,
  CreditCardIcon,
  InformationCircleIcon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type FlightAvailability } from "@workspace/application/read-models";
import { PnrStatus } from "@workspace/domain/booking";
import { type CurrencyCode, Money } from "@workspace/domain/kernel";
import { type BookingSegment } from "@workspace/domain/segment";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Heading } from "@workspace/ui/components/heading";
import { Spinner } from "@workspace/ui/components/spinner";
import { Effect } from "effect";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { getFlightAvailability } from "@/api/inventory.api";
import { EmptyState } from "@/components/shared/empty-state";
import { useBookingMachine } from "@/features/booking/hooks/use-booking-machine";
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatTime,
} from "@/lib/format";
import { BookingStatusBadge } from "../components/booking-status-badge";

// Helper component for Flight Segments
const FlightSegment = ({
  segment,
  status,
}: {
  segment: typeof BookingSegment.Type;
  status?: PnrStatus;
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [flightInfo, setFlightInfo] = useState<
    typeof FlightAvailability.Type | null
  >(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Effect.runPromise(getFlightAvailability(segment.flightId))
      .then((info) => {
        if (mounted) {
          setFlightInfo(info);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch flight info", err);
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [segment.flightId]);

  if (loading) {
    return <Spinner className="h-48" />;
  }

  if (!flightInfo) {
    return (
      <EmptyState
        title="Failed to load flight details"
        description="Please try again later"
      />
    );
  }

  const number = flightInfo.flightNumber;
  const origin = flightInfo.origin;
  const destination = flightInfo.destination;

  const depTime =
    flightInfo.departureTime instanceof Date
      ? flightInfo.departureTime
      : formatDateTime(flightInfo.departureTime, locale);
  const arrTime =
    flightInfo.arrivalTime instanceof Date
      ? flightInfo.arrivalTime
      : formatDateTime(flightInfo.arrivalTime, locale);

  return (
    <div className="relative flex flex-col gap-6 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md md:p-10 dark:bg-slate-900 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-900/30">
            <HugeiconsIcon icon={Airplane01Icon} size={24} />
          </div>
          <div>
            <Heading
              title={number}
              description={segment.cabin}
              level="h3"
              descriptionClassName="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
              headerClassName="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
        <BookingStatusBadge
          status={status || PnrStatus.CONFIRMED}
          className="px-4 py-1.5 text-xs"
        />
      </div>

      <div className="flex flex-col gap-10 md:flex-row md:items-center">
        {/* Origin */}
        <div className="flex flex-1 flex-col">
          <span className="text-4xl font-black tracking-tighter text-slate-900 dark:text-slate-100">
            {formatTime(new Date(depTime))}
          </span>
          <span className="text-xl font-bold text-slate-700 dark:text-slate-300">
            {origin}
          </span>
          <span className="mt-2 text-xs font-bold text-slate-500 uppercase dark:text-slate-600">
            {formatDate(new Date(depTime))}
          </span>
        </div>

        {/* Path/Duration */}
        <div className="relative flex flex-1 flex-col items-center justify-center py-6">
          <span className="mb-6 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {formatDuration(flightInfo.durationMinutes)}
          </span>
          <div className="relative flex w-full items-center justify-center">
            <div className="h-[2px] w-full bg-linear-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />
            <div className="absolute flex size-10 items-center justify-center rounded-full bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
              <HugeiconsIcon
                icon={Airplane01Icon}
                size={18}
                className="text-blue-600 dark:text-blue-400"
              />
            </div>
          </div>
          <span className="mt-6 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
            {t("flight.nonStop")}
          </span>
        </div>

        {/* Destination */}
        <div className="flex flex-1 flex-col items-end text-right">
          <span className="text-4xl font-black tracking-tighter text-slate-900 dark:text-slate-100">
            {formatTime(new Date(arrTime))}
          </span>
          <span className="text-xl font-bold text-slate-700 dark:text-slate-300">
            {destination}
          </span>
          <span className="mt-2 text-xs font-bold text-slate-500 uppercase dark:text-slate-600">
            {formatDate(new Date(arrTime))}
          </span>
        </div>
      </div>
    </div>
  );
};

import { type BookingResponse } from "@workspace/api/booking-api";

export const BookingDetailsPage = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { is, context, send } = useBookingMachine();
  const navigate = useNavigate();

  const booking = context.currentBooking as BookingResponse | null;
  const isLoading = is("fetchingBookingDetails");
  const error = context.error;

  const handleRetry = () => {
    if (context.pnrToFetch) {
      send({ type: "FETCH_BOOKING_DETAILS", pnr: context.pnrToFetch });
    }
  };

  const handleBack = () => {
    void navigate("/");
  };

  const totalPrice =
    booking?.segments.reduce((acc, segment) => {
      // Handling Money object from domain
      const amount =
        typeof segment.price === "number"
          ? segment.price
          : segment.price.amount;
      return acc + amount;
    }, 0) ?? 0;

  const currency = booking?.segments[0]?.price?.currency ?? "EUR";

  return (
    <div className="px-4 py-10 transition-colors duration-300 max-w-7xl mx-auto">
      {/* Top Header with Breadcrumbs & Actions */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/60 mb-5 dark:border-slate-800 sticky top-0 z-30 transition-colors duration-300 rounded-lg sm:py-5">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
          </Button>
          <div className="flex flex-col">
            <Heading
              level="h3"
              description={booking ? `${booking.pnrCode}` : t("common.loading")}
              title={t("booking.details.manage")}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-6">
          <div className="relative">
            <div className="absolute -inset-4 animate-spin rounded-full border-2 border-blue-600/20 border-t-blue-600" />
            <div className="flex size-16 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-xl ring-1 ring-slate-100 dark:ring-slate-700">
              <HugeiconsIcon
                icon={Airplane01Icon}
                size={32}
                className="text-blue-600 dark:text-blue-400"
              />
            </div>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {t("common.loading")}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("booking.details.preparing")}
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="flex h-[50dvh] flex-col items-center justify-center">
          <EmptyState
            isError
            icon={
              <HugeiconsIcon
                icon={Alert01Icon}
                size={64}
                className="text-destructive"
              />
            }
            title={t("common.error")}
            description={error}
            action={
              <Button
                onClick={handleRetry}
                variant={"destructive"}
                className="mt-6 font-bold"
              >
                {t("common.retry")}
              </Button>
            }
          />
        </div>
      ) : booking ? (
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content: Flight Details */}
          <div className="space-y-8 lg:col-span-2">
            <div className="flex flex-col gap-4">
              <Heading
                title={t("booking.details.flights")}
                className="mb-0"
                level="h3"
              />

              <div className="space-y-6">
                {booking.segments.map((segment) => (
                  <FlightSegment
                    key={segment.id}
                    segment={segment}
                    status={booking.status}
                  />
                ))}
              </div>
            </div>

            {/* Passenger Info Section */}
            <div className="space-y-6 rounded-[2.5rem] bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-slate-200/60 dark:ring-slate-800 transition-colors duration-300">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-100 dark:ring-blue-900/30">
                  <HugeiconsIcon icon={UserCircleIcon} size={20} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {t("booking.passengers")}
                </h3>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {booking.passengers.map((passenger) => (
                  <div
                    key={passenger.id}
                    className="flex items-center gap-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 ring-1 ring-slate-200/50 dark:ring-slate-800 transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800"
                  >
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
                      <HugeiconsIcon icon={UserCircleIcon} size={24} />
                    </div>
                    <div className="flex flex-col">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        {passenger.firstName} {passenger.lastName}
                      </p>
                      <Badge
                        variant="outline"
                        className="mt-1 w-fit border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400"
                      >
                        {t(`search.${passenger.type.toLowerCase()}` as any)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar: Payment & Summary */}
          <div className="space-y-8">
            {/* Payment Summary */}
            <div className="overflow-hidden rounded-[2.5rem] bg-slate-900 dark:bg-slate-950 p-8 text-white shadow-2xl shadow-blue-900/20 dark:shadow-none ring-1 dark:ring-slate-800">
              <div className="mb-8 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/20">
                  <HugeiconsIcon icon={CreditCardIcon} size={20} />
                </div>
                <h3 className="text-xl font-bold">
                  {t("booking.paymentSummary")}
                </h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-sm font-medium">
                    {t("booking.fare")}
                  </span>
                  <span className="font-bold text-white">
                    {formatMoney(
                      Money.of(totalPrice * 0.85, currency as CurrencyCode),
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-sm font-medium">
                    {t("booking.taxes")}
                  </span>
                  <span className="font-bold text-white">
                    {formatMoney(
                      Money.of(totalPrice * 0.15, currency as CurrencyCode),
                    )}
                  </span>
                </div>
                <div className="my-6 h-px bg-white/10" />
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">
                    {t("booking.totalPrice")}
                  </span>
                  <span className="text-3xl font-black text-blue-400">
                    {formatMoney(
                      Money.of(totalPrice, currency as CurrencyCode),
                    )}
                  </span>
                </div>
              </div>

              {booking.status === "Held" && (
                <Button className="mt-8 w-full rounded-2xl bg-blue-500 py-6 font-bold text-white hover:bg-blue-400 dark:bg-blue-600 dark:hover:bg-blue-500">
                  {t("booking.actions.payNow")}
                </Button>
              )}
            </div>

            {/* Booking Info Card */}
            <div className="rounded-[2.5rem] bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-slate-200/60 dark:ring-slate-800 transition-colors duration-300">
              <div className="mb-6 flex items-center gap-3 text-slate-900 dark:text-slate-100">
                <div className="flex size-10 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 ring-1 ring-slate-200 dark:ring-slate-700">
                  <HugeiconsIcon icon={InformationCircleIcon} size={20} />
                </div>
                <h3 className="text-lg font-bold">{t("booking.info")}</h3>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {t("booking.createdAt")}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {formatDateTime(new Date(booking.createdAt), locale)}
                  </span>
                </div>

                {booking.status === "Held" &&
                  booking.expiresAt._tag === "Some" && (
                    <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 p-4 ring-1 ring-amber-100/50 dark:ring-amber-900/30">
                      <div className="flex items-center gap-3">
                        <HugeiconsIcon
                          icon={Calendar03Icon}
                          size={20}
                          className="text-amber-600 dark:text-amber-400"
                        />
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                            {t("booking.expiresAt")}
                          </span>
                          <span className="text-sm font-bold text-amber-900 dark:text-amber-100">
                            {formatDateTime(
                              new Date(booking.expiresAt.value),
                              locale,
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
