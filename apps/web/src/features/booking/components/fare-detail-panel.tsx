import { type CabinClass } from "@workspace/domain/kernel";
import { Button } from "@workspace/ui/components/button";
import { useTranslation } from "react-i18next";
import { type FlightResult } from "../machines/booking.machine";

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
  const totalPrice = Number(
    (
      cabinData.price.amount *
      (passengers.adults * 1.0 + passengers.children * 0.75)
    ).toFixed(2),
  );

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-white/10 rounded-b-xl">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold dark:text-white">
            {t(`select.${cabin}` as any)}
          </h2>
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex items-baseline gap-2">
              <p className="text-slate-900 font-bold text-xl dark:text-white">
                {totalPrice} {cabinData.price.currency}
              </p>
              {totalPassengers > 1 && (
                <span className="text-xs text-slate-500 font-medium">
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
                    {passengers.adults}x {t("search.adults")} :{" "}
                    {Number(
                      (cabinData.price.amount * passengers.adults).toFixed(2),
                    )}{" "}
                    {cabinData.price.currency}
                  </p>
                )}
                {passengers.children > 0 && (
                  <p>
                    {passengers.children}x {t("search.children")} :{" "}
                    {Number(
                      (
                        cabinData.price.amount *
                        passengers.children *
                        0.75
                      ).toFixed(2),
                    )}{" "}
                    {cabinData.price.currency}
                  </p>
                )}
                {passengers.infants > 0 && (
                  <p>
                    {passengers.infants}x {t("search.infants")} : 0{" "}
                    {cabinData.price.currency}
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
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                ✓
              </span>
              <span>{t("select.features.bags.small")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                ✓
              </span>
              <span>{t("select.features.bags.cabin")}*</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                ✓
              </span>
              <span>{t(`select.rules.baggage.${cabin}` as any)}</span>
            </li>
            <li className="flex items-start gap-2">
              {cabin === "ECONOMY" ? (
                <span className="text-red-500 dark:text-red-400 font-bold">
                  ✕
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  ✓
                </span>
              )}
              <span>{t(`select.rules.seat.${cabin}` as any)}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                ✓
              </span>
              <span>{t(`select.rules.modification.${cabin}` as any)}</span>
            </li>
            <li className="flex items-start gap-2">
              {cabin === "ECONOMY" ? (
                <span className="text-red-500 dark:text-red-400 font-bold">
                  ✕
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  ✓
                </span>
              )}
              <span>{t(`select.rules.refund.${cabin}` as any)}</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-8">
          {t("select.rules.disclaimer" as any)}
        </p>
      </div>

      <div className="flex justify-end pt-4 border-t dark:border-white/10">
        <Button
          onClick={onConfirm}
          className="w-full sm:w-auto px-8 text-base h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all"
        >
          {t("select.continue")}
        </Button>
      </div>
    </div>
  );
};
