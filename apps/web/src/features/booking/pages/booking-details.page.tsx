import {
  Alert01Icon,
  ArrowLeft01Icon,
  Calendar03Icon,
  CreditCardIcon,
  PassportIcon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type CurrencyCode, Money } from "@workspace/domain/kernel";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Heading } from "@workspace/ui/components/heading";
import { SectionCard } from "@workspace/ui/components/section-card";
import { Spinner } from "@workspace/ui/components/spinner";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/shared/empty-state";
import { useBookingMachine } from "@/features/booking/hooks/use-booking-machine";
import { formatDateTime, formatMoney } from "@/lib/format";

export const BookingDetailsPage = () => {
  const { t } = useTranslation();
  const { is, context, send } = useBookingMachine();

  const booking = context.currentBooking;
  const isLoading = is("fetchingBookingDetails");
  const error = context.error;

  const handleRetry = () => {
    if (context.pnrToFetch) {
      send({ type: "FETCH_BOOKING_DETAILS", pnr: context.pnrToFetch });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "held":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "confirmed":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "ticketed":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "cancelled":
        return "bg-rose-100 text-rose-700 border-rose-200";
      case "expired":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
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
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="mb-8 flex items-center justify-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => send({ type: "BACK" })}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={24} />
          <span className="sr-only">{t("common.back")}</span>
        </Button>
        <Heading
          title={t("booking.details.title")}
          description={t("booking.details.subtitle")}
        />
      </div>

      {isLoading ? (
        <div className="flex h-40 flex-col items-center justify-center gap-4">
          <Spinner className="size-8 text-primary" />
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      ) : error ? (
        <EmptyState
          isError
          icon={
            <HugeiconsIcon
              icon={Alert01Icon}
              size={48}
              className="text-destructive/60"
            />
          }
          title={t("common.error")}
          description={error}
          action={
            <Button variant="outline" className="mt-4" onClick={handleRetry}>
              {t("common.retry")}
            </Button>
          }
        />
      ) : booking ? (
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-white/50 shadow-xl backdrop-blur-md dark:bg-slate-900/50">
          <div className="border-b border-border/50 bg-slate-50/50 p-6 dark:bg-slate-900/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground tracking-wider mb-1">
                {t("booking.pnr")}
              </p>
              <h2 className="text-3xl font-black">{booking.pnrCode}</h2>
            </div>

            <Badge
              variant="outline"
              className={`rounded-full border px-4 py-2 text-sm font-bold uppercase tracking-widest ${getStatusColor(
                booking.status,
              )}`}
            >
              {booking.status}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 lg:p-8 items-start">
            <div className="space-y-6">
              <SectionCard
                title={t("booking.paymentSummary")}
                icon={<HugeiconsIcon icon={CreditCardIcon} size={20} />}
                variant="outlined"
                className="bg-slate-50/50 dark:bg-slate-900/20"
              >
                <div className="flex justify-between items-center text-lg">
                  <span className="text-muted-foreground font-medium">
                    {t("booking.totalPrice")}
                  </span>
                  <span className="font-bold text-foreground">
                    {formatMoney(
                      Money.of(totalPrice, currency as CurrencyCode),
                    )}
                  </span>
                </div>
              </SectionCard>

              <SectionCard
                title={t("booking.passengers")}
                icon={<HugeiconsIcon icon={PassportIcon} size={20} />}
                variant="outlined"
                className="bg-slate-50/50 dark:bg-slate-900/20"
              >
                <div className="space-y-4">
                  {booking.passengers.map((passenger) => (
                    <div
                      key={passenger.id}
                      className="flex items-start gap-3 pb-3 border-b border-slate-200 dark:border-slate-800 last:border-0 last:pb-0"
                    >
                      <div className="flex size-10 mt-1 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                        <HugeiconsIcon icon={UserCircleIcon} size={20} />
                      </div>
                      <div className="flex flex-col">
                        <p className="font-semibold text-foreground">
                          {passenger.firstName} {passenger.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {passenger.email}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t(`search.${passenger.type.toLowerCase()}` as any)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            <div className="space-y-6">
              <SectionCard
                title={t("booking.dates")}
                icon={<HugeiconsIcon icon={Calendar03Icon} size={20} />}
                variant="outlined"
                className="bg-slate-50/50 dark:bg-slate-900/20"
              >
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground uppercase">
                      {t("booking.createdAt")}
                    </span>
                    <span className="font-medium text-foreground">
                      {formatDateTime(new Date(booking.createdAt))}
                    </span>
                  </div>

                  {booking.status === "Held" &&
                    booking.expiresAt._tag === "Some" && (
                      <div className="mt-2 border-t border-slate-200 dark:border-slate-800 pt-4">
                        <div className="flex items-center gap-3 text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50">
                          <HugeiconsIcon
                            icon={Calendar03Icon}
                            size={24}
                            className="shrink-0"
                          />
                          <div className="flex flex-col">
                            <p className="text-xs font-bold uppercase tracking-wide mb-0.5">
                              {t("booking.expiresAt")}
                            </p>
                            <p className="font-semibold">
                              {formatDateTime(
                                new Date(booking.expiresAt.value),
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              </SectionCard>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
