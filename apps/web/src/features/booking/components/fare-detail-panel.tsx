import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  type CabinClass,
  type CurrencyCode,
  Money,
} from "@workspace/domain/kernel";
import { Button } from "@workspace/ui/components/button";
import { Heading } from "@workspace/ui/components/heading";
import { cn } from "@workspace/ui/lib/utils";
import { useTranslation } from "react-i18next";
import { type FlightResult } from "@/features/booking/machines/booking.machine";
import { formatMoney } from "@/lib/format";

export type FareDetailPanelProps = {
  readonly flight: FlightResult;
  readonly cabin: CabinClass;
  readonly passengers: { adults: number; children: number; infants: number };
  readonly onConfirm: () => void;
};

export const FareDetailPanel = ({
  flight,
  cabin,
  passengers,
  onConfirm,
}: FareDetailPanelProps) => {
  const { t } = useTranslation();
  const cabinData = flight.cabins.find((c) => c.cabin === cabin);

  if (!cabinData) return null;

  const totalPassengers =
    passengers.adults + passengers.children + passengers.infants;

  const totalPriceAmount =
    cabinData.price.amount *
    (passengers.adults * 1.0 + passengers.children * 0.75);

  return (
    <div className="flex flex-col gap-6 p-6 bg-accent/5 dark:bg-accent/10 border-t border-border/40 rounded-b-2xl animate-in slide-in-from-top-4 duration-500">
      <div className="flex justify-between items-start">
        <div className="w-full">
          <Heading title={t(`select.${cabin}`)} className="mb-4" />
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex items-baseline gap-2">
              <p className="text-foreground font-black text-2xl tracking-tight">
                {formatMoney(
                  Money.of(
                    totalPriceAmount,
                    cabinData.price.currency as CurrencyCode,
                  ),
                )}
              </p>
              {totalPassengers > 1 && (
                <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                  {t("common.totalFor", { defaultValue: "au total pour" })}{" "}
                  {totalPassengers} {t("common.passengers").toLowerCase()}
                </span>
              )}
            </div>

            {/* Breakdown */}
            {totalPassengers > 1 && (
              <div className="flex flex-col gap-0.5 mt-2 text-sm text-slate-500 dark:text-slate-400 border-l-2 border-slate-200 dark:border-white/10 pl-3">
                {passengers.adults > 0 && (
                  <p>
                    {t("search.adults", { count: passengers.adults })} :{" "}
                    {formatMoney(
                      Money.of(
                        cabinData.price.amount * passengers.adults,
                        cabinData.price.currency as CurrencyCode,
                      ),
                    )}
                  </p>
                )}
                {passengers.children > 0 && (
                  <p>
                    {t("search.children", { count: passengers.children })} :{" "}
                    {formatMoney(
                      Money.of(
                        cabinData.price.amount * passengers.children * 0.75,
                        cabinData.price.currency as CurrencyCode,
                      ),
                    )}
                  </p>
                )}
                {passengers.infants > 0 && (
                  <p>
                    {t("search.infants", { count: passengers.infants })} :{" "}
                    {formatMoney(
                      Money.of(0, cabinData.price.currency as CurrencyCode),
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
            {t("select.includedPerPassenger")}
          </h3>
          <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300 mt-4">
            {(
              [
                { key: "select.features.bags.small", included: true },
                {
                  key: `select.features.bags.cabin`,
                  included: true,
                  suffix: "*",
                },
                { key: `select.rules.baggage.${cabin}`, included: true },
                {
                  key: `select.rules.seat.${cabin}`,
                  included: cabin !== "ECONOMY",
                },
                { key: `select.rules.modification.${cabin}`, included: true },
                {
                  key: `select.rules.refund.${cabin}`,
                  included: cabin !== "ECONOMY",
                },
              ] as ReadonlyArray<{
                key: string;
                included: boolean;
                suffix?: string;
              }>
            ).map(({ key, included, suffix }) => (
              <li key={key} className="flex items-start gap-2">
                <HugeiconsIcon
                  icon={included ? Tick02Icon : Cancel01Icon}
                  size={16}
                  strokeWidth={2.5}
                  className={cn(
                    "mt-0.5 shrink-0",
                    included
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-500 dark:text-red-400",
                  )}
                />
                <span>
                  {(t as (k: string) => string)(key)}
                  {suffix}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-8">
          {t("select.rules.disclaimer")}
        </p>
      </div>

      <div className="flex justify-end pt-6 border-t border-border/40">
        <Button
          onClick={onConfirm}
          className="w-full sm:w-auto px-10 text-base h-12 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-black tracking-widest transition-all hover:scale-105 premium-shadow"
        >
          {t("select.continue").toUpperCase()}
        </Button>
      </div>
    </div>
  );
};
