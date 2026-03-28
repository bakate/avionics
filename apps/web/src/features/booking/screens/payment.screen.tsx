import {
  Airplane01Icon,
  Calendar01Icon,
  Mail01Icon,
  PassportIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type CurrencyCode, Money } from "@workspace/domain/kernel";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Heading } from "@workspace/ui/components/heading";
import { SectionCard } from "@workspace/ui/components/section-card";
import { Spinner } from "@workspace/ui/components/spinner";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { useBookingMachine } from "@/features/booking/hooks/use-booking-machine";
import {
  formatDate,
  formatDuration,
  formatMoney,
  formatTime,
} from "@/lib/format";
import { ROUTES } from "@/routes";

export const SummaryScreen = () => {
  const { is, send, context } = useBookingMachine();
  const { t } = useTranslation();

  // Redirect to start if missing data
  if (
    !context.searchParams ||
    !context.selectedOutbound ||
    context.passengers.length === 0
  ) {
    return <Navigate to={ROUTES.home} />;
  }

  const handlePayment = () => {
    send({ type: "CONFIRM_PAYMENT" });
  };

  // State calculations
  const outboundFlight = context.selectedOutbound.flight;
  const outboundPrice = context.selectedOutbound.price;
  const returnFlight = context.selectedReturn?.flight;
  const returnPrice = context.selectedReturn?.price;

  const totalAmount =
    (outboundPrice.amount + (returnPrice?.amount || 0)) *
    context.passengers.length;

  return (
    <div className="mx-auto max-w-6xl py-12 px-4 sm:px-6 lg:px-8">
      <Heading
        title={t("payment.title")}
        description={t("payment.subtitle")}
        descriptionClassName="mb-12"
      />

      <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1 space-y-8">
          {/* Outbound Flight */}
          <SectionCard
            title={t("payment.outboundFlight")}
            className="pt-0"
            icon={
              <HugeiconsIcon
                icon={Airplane01Icon}
                size={20}
                className="rotate-45"
              />
            }
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {formatTime(new Date(outboundFlight.departureTime))}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {outboundFlight.origin}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center relative px-4">
                    <div className="w-full h-px bg-border absolute top-1/2 -translate-y-1/2" />
                    <div className="bg-background z-10 px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider rounded-full border border-border">
                      {formatDuration(outboundFlight.durationMinutes)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {formatTime(new Date(outboundFlight.arrivalTime))}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {outboundFlight.destination}
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  {formatDate(new Date(outboundFlight.departureTime))}
                </div>
              </div>
              <div className="sm:border-l sm:pl-6 flex flex-col sm:items-end w-full sm:w-auto gap-2">
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">
                    {t("payment.cabin")}
                  </div>
                  <div className="font-semibold text-foreground capitalize">
                    {context.selectedOutbound.cabin.toLowerCase()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">
                    {t("payment.flight")}
                  </div>
                  <div className="font-semibold text-foreground">
                    {outboundFlight.flightNumber}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Return Flight */}
          {returnFlight && (
            <SectionCard
              title={t("payment.returnFlight")}
              icon={
                <HugeiconsIcon
                  icon={Airplane01Icon}
                  size={20}
                  className="-rotate-135"
                />
              }
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {formatTime(new Date(returnFlight.departureTime))}
                      </div>
                      <div className="text-sm font-medium text-muted-foreground">
                        {returnFlight.origin}
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center relative px-4">
                      <div className="w-full h-px bg-border absolute top-1/2 -translate-y-1/2" />
                      <div className="bg-background z-10 px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider rounded-full border border-border">
                        {formatDuration(returnFlight.durationMinutes)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {formatTime(new Date(returnFlight.arrivalTime))}
                      </div>
                      <div className="text-sm font-medium text-muted-foreground">
                        {returnFlight.destination}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-muted-foreground">
                    {formatDate(new Date(returnFlight.departureTime))}
                  </div>
                </div>
                <div className="sm:border-l sm:pl-6 flex flex-col sm:items-end w-full sm:w-auto gap-2">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">
                      {t("payment.cabin")}
                    </div>
                    <div className="font-semibold text-foreground capitalize">
                      {context.selectedReturn?.cabin.toLowerCase()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">
                      {t("payment.flight")}
                    </div>
                    <div className="font-semibold text-foreground">
                      {returnFlight.flightNumber}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Passengers */}
          <SectionCard
            title={t("payment.passengersLabel")}
            icon={<HugeiconsIcon icon={PassportIcon} size={20} />}
          >
            <ul className="divide-y divide-border/40">
              {context.passengers.map((p, idx) => (
                <li key={idx} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-primary/10 p-1.5 rounded-full text-primary">
                      <HugeiconsIcon icon={PassportIcon} size={16} />
                    </div>
                    <div className="font-bold text-lg text-foreground">
                      {t(
                        `passengers.genderTypes.${p.gender.toLowerCase() as "male" | "female"}`,
                      )}{" "}
                      {p.firstName} {p.lastName}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-8 gap-y-2 text-[13px] mt-4 ml-1.5">
                    <div className="flex items-center gap-2 text-foreground/80 font-medium">
                      <HugeiconsIcon
                        icon={Calendar01Icon}
                        size={14}
                        className="text-primary"
                      />
                      {formatDate(new Date(p.dateOfBirth))}
                    </div>
                    <div className="flex items-center gap-2 text-foreground/80 font-medium">
                      <HugeiconsIcon
                        icon={Mail01Icon}
                        size={14}
                        className="text-primary"
                      />
                      {p.email}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <div className="w-full lg:w-[380px]">
          <div className="sticky top-8">
            <Card className="border-border shadow-md overflow-hidden bg-background pt-0">
              <div className="bg-linear-to-br from-blue-950 to-slate-900 px-6 py-6 border-b border-white/10">
                <Heading
                  title={t("payment.priceSummary")}
                  description={t("payment.taxesIncluded")}
                  headerClassName="text-xl text-white font-bold"
                  descriptionClassName="text-blue-200/60 font-medium text-xs mt-1 uppercase tracking-wider"
                  className="py-0 mb-0 space-y-0"
                />
              </div>
              <CardContent className="p-6">
                <div className="space-y-4 text-sm text-muted-foreground">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>{t("payment.passengersLabel")}</span>
                    <span className="font-medium text-foreground">
                      {context.passengers.length} ×
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-600">
                    <span>{t("payment.outboundFlight")}</span>
                    <span className="font-medium text-foreground">
                      {formatMoney(
                        Money.of(
                          outboundPrice.amount,
                          outboundPrice.currency as CurrencyCode,
                        ),
                      )}
                    </span>
                  </div>

                  {returnFlight && returnPrice && (
                    <div className="flex justify-between items-center text-slate-600">
                      <span>{t("payment.returnFlight")}</span>
                      <span className="font-medium text-foreground">
                        {formatMoney(
                          Money.of(
                            returnPrice.amount,
                            returnPrice.currency as CurrencyCode,
                          ),
                        )}
                      </span>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 mt-4">
                    <div className="flex justify-between items-end">
                      <span className="text-lg font-bold text-foreground">
                        {t("payment.totalPrice")}
                      </span>
                      <span className="text-3xl font-black tracking-tight text-primary">
                        {formatMoney(
                          Money.of(
                            totalAmount,
                            outboundPrice.currency as CurrencyCode,
                          ),
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 text-right mt-1">
                      {t("payment.taxesIncluded")}
                    </p>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <Button
                    size="lg"
                    className="w-full h-14 text-lg font-bold transition-all relative overflow-hidden group"
                    onClick={handlePayment}
                    disabled={is("paying")}
                  >
                    {is("paying") ? (
                      <span className="flex items-center gap-3">
                        <Spinner className="size-5" />
                        {t("payment.processing")}
                      </span>
                    ) : (
                      t("payment.confirm")
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full h-12 font-medium"
                    type="button"
                    onClick={() => send({ type: "BACK" })}
                    disabled={is("paying")}
                  >
                    {t("passengers.back")}
                  </Button>
                </div>

                {context.error && (
                  <div className="mt-6 p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-xs font-semibold">
                    {t(context.error as "payment.errorCancelled")}
                  </div>
                )}

                <div className="mt-8 pt-6 border-t border-border/50 text-center">
                  <div className="inline-flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    {t("payment.securePayment")}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Demo Help Card */}
            <SectionCard
              title={t("payment.demoGuide")}
              className="mt-6 border-primary/20 bg-primary/5 shadow-sm overflow-hidden"
              icon={<HugeiconsIcon icon={Airplane01Icon} size={18} />}
            >
              <p className="text-sm text-muted-foreground mb-2">
                {t("payment.demoPrompt")}
              </p>
              <div className="bg-background rounded-lg border border-primary/10 p-3 space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("payment.cardNumber")}:
                  </span>
                  <span className="font-bold text-primary">
                    4242 4242 4242 4242
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("payment.cardExpCvc")}:
                  </span>
                  <span className="font-bold text-primary">01/32 - 123</span>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
};
